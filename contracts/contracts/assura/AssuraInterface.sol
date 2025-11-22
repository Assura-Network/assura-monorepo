// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

interface AssuraInterface {
    function setVerifyingData(address app, bytes32 key, VerifyingData memory verifyingData) external;
    function getVerifyingData(address app, bytes32 key) external view returns (VerifyingData memory);
    function verify(address app, bytes32 key) external view returns (bool);
}