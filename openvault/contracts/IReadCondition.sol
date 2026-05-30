// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title ICDR read-condition interface
/// @notice CDR validators staticcall this to decide whether `caller` may read a
/// vault. The exact signature was recovered from Story Aeneid's deployed
/// LicenseReadCondition (0xC0640AD4CF2CaA9914C8e5C44234359a9102f7a3):
///   checkReadCondition(uint32, bytes accessAuxData, bytes readConditionData, address caller) view returns (bool)
/// - `label`            : the CDR vault label (passed through to composed conditions)
/// - `accessAuxData`    : caller-supplied data at downloadFile (e.g. license token ids)
/// - `readConditionData`: vault-bound data fixed at upload (the rule's parameters)
/// - `caller`           : the address attempting to read
interface IReadCondition {
    function checkReadCondition(
        uint32 label,
        bytes calldata accessAuxData,
        bytes calldata readConditionData,
        address caller
    ) external view returns (bool);
}
