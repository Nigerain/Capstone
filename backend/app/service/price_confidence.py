from datetime import datetime, timezone

from app.service.dataconnect import (
    get_price_votes,
    get_price_submitters,
    get_price_confidence_data,
    get_user_stats,
    get_submitter_vote_history,
)

from app.services.consensus import (
    Vote,
    WeightedVote,
    calculate_consensus,
    calculate_weighted_consensus,
)

from app.services.submitter_reputation import (
    VoteHistory,
    calculate_pool_reputation,
    calculate_reputation_from_history,
)

from app.services.confidence import (
    calculate_confidence,
    calculate_price_age_days,
    count_qualifying_confirmations,
    ConfirmationVote,
)
from app.services.voter_reputation import calculate_voter_reputation


def get_user_vote_history(user_id: str, id_token: str) -> list[VoteHistory]:
    history = []
    limit = 100
    offset = 0

    while True:
        rows = get_submitter_vote_history(
            user_id=user_id,
            limit=limit,
            offset=offset,
            id_token=id_token,
        )

        for row in rows:
            submitted_at = row.get("submittedAt")
            if submitted_at:
                submitted_at = datetime.fromisoformat(
                    submitted_at.replace("Z", "+00:00")
                )

            history.append(
                VoteHistory(
                    price_record_id=row["priceRecordId"],
                    upvotes=int(row["upvotes"]),
                    downvotes=int(row["downvotes"]),
                    submitted_at=submitted_at,
                )
            )
        if len(rows) < limit:
            break

        offset += limit
    return history


def get_pool_submitter_reputation(price_record_id: str, id_token: str) -> float:
    submitter_histories = {}
    limit = 100
    offset = 0

    while True:
        submitters = get_price_submitters(
            price_record_id=price_record_id,
            id_token=id_token,
            limit=limit,
            offset=offset,
        )

        for submitter in submitters:
            user_id = submitter["userId"]

            if user_id not in submitter_histories:
                submitter_histories[user_id] = get_user_vote_history(
                    user_id=user_id,
                    id_token=id_token,
                )

        if len(submitters) < limit:
            break

        offset += limit

    if not submitter_histories:
        raise ValueError("No active submitters found for this price record")

    return calculate_pool_reputation(
        submitter_histories,
        excluded_price_record_id=price_record_id,
    )


def get_voter_weight(user_id: str, price_record_id: str, id_token: str) -> float:
    stats = get_user_stats(user_id, id_token)

    user = stats["user"]
    submission_count = int(stats["totalSubmissions"]["count"])

    created_at = datetime.fromisoformat(user["createdAt"].replace("Z", "+00:00"))

    account_age_days = max(
        0.0,
        (datetime.now(timezone.utc) - created_at).total_seconds() / 86400,
    )

    history = get_user_vote_history(user_id, id_token)

    upvotes = sum(
        row.upvotes for row in history if row.price_record_id != price_record_id
    )

    downvotes = sum(
        row.downvotes for row in history if row.price_record_id != price_record_id
    )

    return calculate_voter_reputation(
        upvotes=upvotes,
        downvotes=downvotes,
        account_age_days=account_age_days,
        submission_count=submission_count,
    )


def get_voting_consensus(price_record_id: str, id_token: str):
    votes = []
    weighted_votes = []
    confirmation_votes = []
    limit = 100
    offset = 0

    while True:
        rows = get_price_votes(
            price_record_id=price_record_id,
            limit=limit,
            offset=offset,
            id_token=id_token,
        )

        for row in rows:
            user_id = row["userId"]
            is_upvote = row["isUpvote"]

            votes.append(Vote(user_id=user_id, is_upvote=is_upvote))

            weight = get_voter_weight(user_id, price_record_id, id_token)

            weighted_votes.append(
                WeightedVote(
                    user_id=user_id,
                    is_upvote=is_upvote,
                    weight=weight,
                )
            )

            confirmation_votes.append(
                ConfirmationVote(
                    user_id=user_id,
                    is_upvote=is_upvote,
                    recorded_at=datetime.fromisoformat(
                        row["createdAt"].replace("Z", "+00:00")
                    ),
                )
            )
        if len(rows) < limit:
            break

        offset += limit

    return (
        calculate_consensus(votes),
        calculate_weighted_consensus(weighted_votes),
        confirmation_votes,
    )


def get_price_confidence(price_record_id: str, id_token: str):
    records = get_price_confidence_data(price_record_id, id_token)

    if not records:
        raise ValueError("Price record not found")

    record = records[0]

    now = datetime.now(timezone.utc)

    recorded_at = datetime.fromisoformat(record["dateRecorded"].replace("Z", "+00:00"))

    if recorded_at.tzinfo is None:
        recorded_at = recorded_at.replace(tzinfo=timezone.utc)

    submitter_reputation = get_pool_submitter_reputation(price_record_id, id_token)

    simple_consensus, weighted_consensus, confirmation_votes = get_voting_consensus(
        price_record_id, id_token
    )

    price_age_days = calculate_price_age_days(recorded_at, now=now)

    qualifying_confirmations = count_qualifying_confirmations(
        confirmation_votes,
        recorded_at=recorded_at,
        now=now,
    )

    confidence = calculate_confidence(
        submitter_reputation=submitter_reputation,
        simple_consensus=simple_consensus,
        weighted_consensus=weighted_consensus,
        price_age_days=price_age_days,
        qualifying_confirmations=qualifying_confirmations,
    )

    return {
        "priceRecordId": price_record_id,
        "confidence": round(confidence, 4),
        "submitterReputation": round(submitter_reputation, 4),
        "simpleConsensus": round(simple_consensus, 4),
        "weightedConsensus": round(weighted_consensus, 4),
        "priceAgeDays": round(price_age_days, 2),
        "qualifyingConfirmations": qualifying_confirmations,
    }
