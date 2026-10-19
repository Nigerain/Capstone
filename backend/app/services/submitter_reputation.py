# calculate submitter reputation using their upvotes and downvotes.

from dataclasses import dataclass
from datetime import datetime
from math import fsum
from typing import Iterable, Mapping

from .validators import (
    validate_count, validate_history_row, validate_identifier,
    validate_nonempty_pool, validate_number, validate_positive,
)

DEFAULT_ALPHA = 2.0
DEFAULT_BETA = 2.0


def calculate_reputation(
    upvotes: int, downvotes: int,
    alpha: float = DEFAULT_ALPHA, beta: float = DEFAULT_BETA,
) -> float:
    # use votes from when the user was supporting the price. each vote counts equally.
    validate_count("upvotes", upvotes)
    validate_count("downvotes", downvotes)
    validate_number("alpha", alpha)
    validate_number("beta", beta)
    validate_positive(alpha, "Alpha and beta must be positive.")
    validate_positive(beta, "Alpha and beta must be positive.")
    # scale the values so large vote counts do not overflow.
    scale = max(upvotes, downvotes, alpha, beta)
    up, down = upvotes / scale, downvotes / scale
    prior_up, prior_down = alpha / scale, beta / scale
    return (up + prior_up) / (up + down + prior_up + prior_down)


@dataclass(frozen=True)
class VoteHistory:
    price_record_id: str
    upvotes: int
    downvotes: int
    submitted_at: datetime | None = None


def calculate_reputation_from_history(
    history: Iterable[VoteHistory], *, excluded_price_record_id: str,
    alpha: float = DEFAULT_ALPHA, beta: float = DEFAULT_BETA,
) -> float:
    # add up their vote history. skip every submission for the price being checked.
    validate_identifier(excluded_price_record_id, "An excluded price record ID is required.")
    upvotes = downvotes = 0
    seen = set()
    for row in history:
        validate_history_row(row, seen)
        if row.price_record_id != excluded_price_record_id:
            upvotes += row.upvotes
            downvotes += row.downvotes
    return calculate_reputation(upvotes, downvotes, alpha, beta)


def calculate_pool_reputation(
    active_submitter_histories: Mapping[str, Iterable[VoteHistory]], *,
    excluded_price_record_id: str,
    alpha: float = DEFAULT_ALPHA, beta: float = DEFAULT_BETA,
) -> float:
    # average the reputation of everyone currently supporting the price.
    # use each user once and include all their submission history.
    # leave out votes from the shared price being checked.
    validate_nonempty_pool(active_submitter_histories)
    reputations = []
    for user_id, history in active_submitter_histories.items():
        validate_identifier(user_id, "An active submitter ID is required.")
        reputations.append(calculate_reputation_from_history(
            history, excluded_price_record_id=excluded_price_record_id,
            alpha=alpha, beta=beta,
        ))
    return fsum(reputations) / len(reputations)
