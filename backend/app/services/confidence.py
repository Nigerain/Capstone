# calculate price confidence using reputation, votes, and how old the price is.

from dataclasses import dataclass
from datetime import date, datetime, time, timezone
from math import expm1, log1p
from typing import Iterable

from .validators import (
    validate_aware_datetime, validate_confirmation_vote, validate_count,
    validate_number, validate_positive, validate_recorded_date,
    validate_recording_time,
)

DEFAULT_GRACE_DAYS = 2.0
DEFAULT_BONUS_PER_CONFIRMATION = 0.02
DEFAULT_MAX_BONUS = 0.50
DEFAULT_DAILY_PENALTY = 0.01
PENALTY_GROWTH_RATE = 0.1
REPUTATION_WEIGHT = 0.35
SIMPLE_CONSENSUS_WEIGHT = 0.40
WEIGHTED_CONSENSUS_WEIGHT = 0.25


@dataclass(frozen=True)
class ConfirmationVote:
    user_id: str
    is_upvote: bool
    recorded_at: datetime


def _to_utc(value: datetime) -> datetime:
    validate_aware_datetime(value)
    return value.astimezone(timezone.utc)


def count_qualifying_confirmations(
    votes: Iterable[ConfirmationVote], *, recorded_at: datetime,
    now: datetime, grace_days: float = DEFAULT_GRACE_DAYS,
) -> int:
    # count each user once if their current upvote was recorded after the grace period.
    # ignore future votes. createdAt stays the same when they change their vote,
    # so it does not tell us when a downvote became an upvote.
    recorded_at = _to_utc(recorded_at)
    now = _to_utc(now)
    validate_number("grace_days", grace_days)
    validate_recording_time(recorded_at, now)
    seen = set()
    count = 0
    for vote in votes:
        validate_confirmation_vote(vote, seen)
        vote_time = _to_utc(vote.recorded_at)
        elapsed_days = (vote_time - recorded_at).total_seconds() / 86400
        if vote.is_upvote and elapsed_days > grace_days and vote_time <= now:
            count += 1
    return count


def calculate_confidence(
    submitter_reputation: float, simple_consensus: float, weighted_consensus: float,
    price_age_days: float, qualifying_confirmations: int = 0,
    *, grace_days: float = DEFAULT_GRACE_DAYS,
    bonus_per_confirmation: float = DEFAULT_BONUS_PER_CONFIRMATION,
    max_bonus: float = DEFAULT_MAX_BONUS,
    daily_penalty: float = DEFAULT_DAILY_PENALTY,
) -> float:
    # combine submitter reputation and both voting scores.
    # use the price age and later confirmations to adjust the score.
    validate_number("submitter_reputation", submitter_reputation, 1)
    validate_number("simple_consensus", simple_consensus, 1)
    validate_number("weighted_consensus", weighted_consensus, 1)
    validate_number("price_age_days", price_age_days)
    validate_count("qualifying_confirmations", qualifying_confirmations)
    validate_number("grace_days", grace_days)
    validate_number("bonus_per_confirmation", bonus_per_confirmation)
    validate_number("max_bonus", max_bonus)
    validate_number("daily_penalty", daily_penalty)
    validate_positive(daily_penalty, "Daily penalty must be positive so old prices decay.")

    bonus = 0.0
    if price_age_days > grace_days:
        bonus = min(bonus_per_confirmation * qualifying_confirmations, max_bonus)
    # start the penalty small, then make it grow faster as the price gets older.
    days_after_grace = max(0.0, price_age_days - grace_days)
    growth = days_after_grace * PENALTY_GROWTH_RATE
    # once the penalty outweighs even a perfect score and its bonus, return zero.
    cutoff = log1p((1.0 + bonus) / daily_penalty * PENALTY_GROWTH_RATE)
    if growth >= cutoff:
        return 0.0
    penalty = daily_penalty * expm1(growth) / PENALTY_GROWTH_RATE
    result = (REPUTATION_WEIGHT * submitter_reputation
              + SIMPLE_CONSENSUS_WEIGHT * simple_consensus
              + WEIGHTED_CONSENSUS_WEIGHT * weighted_consensus + bonus - penalty)
    return max(0.0, min(1.0, result))


def calculate_price_age_days(recorded_at: date | datetime, *, now: datetime) -> float:
    # calculate how many days old the price is, including part of a day.
    # use midnight UTC if only a date is provided.
    now = _to_utc(now)
    if isinstance(recorded_at, datetime):
        recorded_at = _to_utc(recorded_at)
    else:
        validate_recorded_date(recorded_at)
        recorded_at = datetime.combine(recorded_at, time.min, timezone.utc)
    age = (now - recorded_at).total_seconds() / 86400
    validate_number("price_age_days", age)
    return age
