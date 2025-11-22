// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract AssuraVerifier {

    struct VerifyingData {
        uint256 score;
        uint256 timestamp;
    }

    mapping(address => mapping(address => VerifyingData)) public verifyingData;

    function setVerifyingData(address user, address app, uint256 score, uint256 timestamp) public {
        verifyingData[user][app] = VerifyingData(score, timestamp);
    }

    function getVerifyingData(address user, address app) public view returns (VerifyingData memory) {
        return verifyingData[user][app];
    }

    function verify(address user, address app) public view returns (bool) {
        VerifyingData memory verifyingData = getVerifyingData(user, app);
        return verifyingData.score > 0 && verifyingData.timestamp > 0;
    }
}