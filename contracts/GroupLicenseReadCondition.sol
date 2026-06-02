// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IReadCondition} from "./IReadCondition.sol";

/// @title GroupLicenseReadCondition — one license unlocks a whole family of vaults
/// @notice Resolves SPEC §8.7: instead of per-IP gating, a reader who holds a
/// valid Story license token for ANY member IP of a group can read EVERY member's
/// vault ("subscribe to a lab → unlock all its models/datasets").
///
/// It composes the already-deployed LicenseReadCondition (audited, on Aeneid):
/// for each member IP it staticcalls LicenseReadCondition with that member's
/// `(licenseToken, memberIp)` data and the caller's `accessAuxData` (the license
/// token ids), and ORs the results. No re-implementation of license validation.
///
/// readConditionData = abi.encode(address licenseReadCondition, address licenseToken, address[] memberIpIds)
/// accessAuxData     = abi.encode(uint256[] licenseTokenIds)   // same shape LicenseReadCondition expects
contract GroupLicenseReadCondition is IReadCondition {
    function checkReadCondition(
        uint32 label,
        bytes calldata accessAuxData,
        bytes calldata readConditionData,
        address caller
    ) external view returns (bool) {
        (address licenseReadCondition, address licenseToken, address[] memory members) =
            abi.decode(readConditionData, (address, address, address[]));

        for (uint256 i; i < members.length; ++i) {
            // Per-member data in the exact shape the deployed LicenseReadCondition
            // expects: abi.encode(licenseToken, memberIp).
            bytes memory subData = abi.encode(licenseToken, members[i]);
            (bool ok, bytes memory ret) = licenseReadCondition.staticcall(
                abi.encodeWithSelector(
                    IReadCondition.checkReadCondition.selector,
                    label,
                    accessAuxData,
                    subData,
                    caller
                )
            );
            if (ok && ret.length == 32 && abi.decode(ret, (bool))) {
                return true;
            }
        }
        return false;
    }
}
