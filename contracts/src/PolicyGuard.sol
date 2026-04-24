// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/shared/interfaces/AggregatorV3Interface.sol";

/// @notice Enforces per-trade policy rules for SentinelAccount.
/// All rules are checked before any swap executes.
contract PolicyGuard is Ownable {
    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------
    error PolicyGuard__TokenNotWhitelisted(address token);
    error PolicyGuard__TradeSizeExceeded(uint256 amountUsd, uint256 maxUsd);
    error PolicyGuard__DrawdownExceeded(uint256 currentDrawdown, uint256 limit);
    error PolicyGuard__CooldownActive(address token, uint256 unlocksAt);
    error PolicyGuard__StaleOraclePrice(address feed, uint256 updatedAt);
    error PolicyGuard__OnlySentinelAccount();

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------
    address public sentinelAccount;

    uint256 public maxTradeSizeUsd;   // 18-decimal USD cap per trade
    uint256 public dailyDrawdownLimit; // 18-decimal USD max cumulative loss per 24h
    uint256 public cooldownPeriod;     // seconds between trades on same token

    mapping(address => bool) public tokenWhitelist;

    // drawdown tracking
    uint256 public drawdownWindowStart;
    uint256 public cumulativeDrawdown;

    // cooldown tracking: token => block.timestamp of last trade
    mapping(address => uint256) public lastTradeTime;

    // Chainlink feed for tokenIn USD price
    mapping(address => address) public priceFeeds; // token => AggregatorV3Interface

    uint256 private constant STALENESS_THRESHOLD = 3600; // 1 hour

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event PolicyUpdated(uint256 maxTradeSizeUsd, uint256 dailyDrawdownLimit, uint256 cooldownPeriod);
    event TokenWhitelisted(address indexed token, bool allowed);
    event PriceFeedSet(address indexed token, address indexed feed);
    event DrawdownRecorded(uint256 lossUsd, uint256 cumulativeDrawdown);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(
        address _sentinelAccount,
        uint256 _maxTradeSizeUsd,
        uint256 _dailyDrawdownLimit,
        uint256 _cooldownPeriod
    ) Ownable(msg.sender) {
        sentinelAccount = _sentinelAccount;
        maxTradeSizeUsd = _maxTradeSizeUsd;
        dailyDrawdownLimit = _dailyDrawdownLimit;
        cooldownPeriod = _cooldownPeriod;
        drawdownWindowStart = block.timestamp;
    }

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------
    modifier onlySentinelAccount() {
        if (msg.sender != sentinelAccount) revert PolicyGuard__OnlySentinelAccount();
        _;
    }

    // -------------------------------------------------------------------------
    // Core check — called by SentinelAccount before every swap
    // -------------------------------------------------------------------------

    /// @notice Validates all policy rules. Reverts if any rule is violated.
    /// @param tokenIn  Token being sold
    /// @param tokenOut Token being bought
    /// @param amountIn Raw token amount (in token decimals)
    function checkPolicy(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external onlySentinelAccount {
        if (!tokenWhitelist[tokenIn])  revert PolicyGuard__TokenNotWhitelisted(tokenIn);
        if (!tokenWhitelist[tokenOut]) revert PolicyGuard__TokenNotWhitelisted(tokenOut);

        uint256 amountUsd = _toUsd(tokenIn, amountIn);

        if (amountUsd > maxTradeSizeUsd)
            revert PolicyGuard__TradeSizeExceeded(amountUsd, maxTradeSizeUsd);

        // Only enforce cooldown after the first trade on this token
        if (lastTradeTime[tokenIn] != 0 && block.timestamp - lastTradeTime[tokenIn] < cooldownPeriod)
            revert PolicyGuard__CooldownActive(tokenIn, lastTradeTime[tokenIn] + cooldownPeriod);

        _refreshDrawdownWindow();
        // drawdown is recorded post-trade via recordLoss(); pre-check uses current cumulative
        if (cumulativeDrawdown >= dailyDrawdownLimit)
            revert PolicyGuard__DrawdownExceeded(cumulativeDrawdown, dailyDrawdownLimit);

        lastTradeTime[tokenIn] = block.timestamp;
    }

    /// @notice Called by SentinelAccount after a trade to record realised loss.
    /// @param lossUsd 18-decimal USD loss amount (0 if trade was profitable)
    function recordLoss(uint256 lossUsd) external onlySentinelAccount {
        if (lossUsd == 0) return;
        _refreshDrawdownWindow();
        cumulativeDrawdown += lossUsd;
        emit DrawdownRecorded(lossUsd, cumulativeDrawdown);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------
    function updatePolicy(
        uint256 _maxTradeSizeUsd,
        uint256 _dailyDrawdownLimit,
        uint256 _cooldownPeriod
    ) external onlyOwner {
        maxTradeSizeUsd = _maxTradeSizeUsd;
        dailyDrawdownLimit = _dailyDrawdownLimit;
        cooldownPeriod = _cooldownPeriod;
        emit PolicyUpdated(_maxTradeSizeUsd, _dailyDrawdownLimit, _cooldownPeriod);
    }

    function setTokenWhitelist(address token, bool allowed) external onlyOwner {
        tokenWhitelist[token] = allowed;
        emit TokenWhitelisted(token, allowed);
    }

    function setPriceFeed(address token, address feed) external onlyOwner {
        priceFeeds[token] = feed;
        emit PriceFeedSet(token, feed);
    }

    function setSentinelAccount(address _account) external onlyOwner {
        sentinelAccount = _account;
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    /// @dev Resets the 24h drawdown window if it has expired.
    function _refreshDrawdownWindow() internal {
        if (block.timestamp >= drawdownWindowStart + 24 hours) {
            drawdownWindowStart = block.timestamp;
            cumulativeDrawdown = 0;
        }
    }

    /// @dev Converts token amount to 18-decimal USD using Chainlink feed.
    ///      If no feed is set, returns 0 (trade size check skipped).
    function _toUsd(address token, uint256 amount) internal view returns (uint256) {
        address feed = priceFeeds[token];
        if (feed == address(0)) return 0;

        (, int256 price,, uint256 updatedAt,) = AggregatorV3Interface(feed).latestRoundData();
        if (block.timestamp - updatedAt > STALENESS_THRESHOLD)
            revert PolicyGuard__StaleOraclePrice(feed, updatedAt);
        require(price > 0, "PolicyGuard: non-positive oracle price");

        // Chainlink prices have 8 decimals; normalise to 18
        uint8 feedDecimals = AggregatorV3Interface(feed).decimals();
        // forge-lint: disable-next-line(unsafe-typecast)
        uint256 priceNorm = uint256(price) * (10 ** (18 - feedDecimals));

        // Assume token has 18 decimals for simplicity; adjust per token in production
        return (amount * priceNorm) / 1e18;
    }
}
