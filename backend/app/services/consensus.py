# calculate how much voters agree with a price.

from dataclasses import dataclass
from typing import Iterable

from .validators import validate_number, validate_positive, validate_vote

DEFAULT_SMOOTHING = 2.0


@dataclass(frozen=True)
class Vote:
    user_id: str
    is_upvote: bool


def calculate_consensus(votes: Iterable[Vote]) -> float:
    # divide upvotes by total votes. use 0.5 if nobody has voted.
    seen = set()
    upvotes = 0
    for vote in votes:
        validate_vote(vote, seen)
        if vote.is_upvote:
            upvotes += 1

    return upvotes / len(seen) if seen else 0.5


@dataclass(frozen=True)
class WeightedVote:
    user_id: str
    is_upvote: bool
    weight: float


def calculate_weighted_consensus(
    votes: Iterable[WeightedVote], *, smoothing: float = DEFAULT_SMOOTHING,
) -> float:
    # give more influence to reliable voters. smoothing starts the score at 0.5.
    validate_number("smoothing", smoothing)
    validate_positive(smoothing, "Smoothing must be positive.")
    seen = set()
    upvote_weight = total_weight = 0.0
    for vote in votes:
        validate_vote(vote, seen)
        validate_number("vote weight", vote.weight, 1)
        total_weight += vote.weight
        if vote.is_upvote:
            upvote_weight += vote.weight

    # scale the values so a large smoothing value does not overflow.
    scale = max(total_weight, smoothing)
    return ((upvote_weight / scale + smoothing / scale)
            / (total_weight / scale + 2 * (smoothing / scale)))
