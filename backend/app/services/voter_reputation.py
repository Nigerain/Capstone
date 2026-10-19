# calculate voter reliability using their reputation, account age, and submissions.

from .submitter_reputation import (
    DEFAULT_ALPHA, DEFAULT_BETA, calculate_reputation,
)

from .validators import validate_count, validate_number, validate_positive

REPUTATION_WEIGHT = 0.50
ACCOUNT_WEIGHT = 0.25
SUBMISSION_WEIGHT = 0.25
DEFAULT_ACCOUNT_AGE_CAP = 180.0
DEFAULT_SUBMISSION_CAP = 50


def calculate_voter_reputation(
    upvotes: int, downvotes: int, account_age_days: float, submission_count: int,
    *, alpha: float = DEFAULT_ALPHA, beta: float = DEFAULT_BETA,
    account_age_cap: float = DEFAULT_ACCOUNT_AGE_CAP,
    submission_cap: int = DEFAULT_SUBMISSION_CAP,
) -> float:
    # leave out votes from the price being checked. count each public price pool once.
    reputation = calculate_reputation(upvotes, downvotes, alpha, beta)
    validate_number("account_age_days", account_age_days)
    validate_count("submission_count", submission_count)
    validate_number("account_age_cap", account_age_cap)
    validate_count("submission_cap", submission_cap)
    validate_positive(account_age_cap, "Normalization caps must be positive.")
    validate_positive(submission_cap, "Normalization caps must be positive.")
    age_score = min(account_age_days / account_age_cap, 1)
    submission_score = min(submission_count / submission_cap, 1)
    result = (
        REPUTATION_WEIGHT * reputation
        + ACCOUNT_WEIGHT * age_score
        + SUBMISSION_WEIGHT * submission_score
    )
    return max(0.0, min(1.0, result))

