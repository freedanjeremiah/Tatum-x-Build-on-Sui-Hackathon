// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IReadCondition} from "./IReadCondition.sol";

/// @title ComputeWorkerReadCondition — "computable, not downloadable"
/// @notice Resolves SPEC §C4/§C9: a compute-tier dataset vault may be decrypted
/// ONLY by an allowlisted confidential-compute worker operator — never by a data
/// consumer. The consumer mints a *compute* license (royalties to the data owner)
/// and submits an allowlisted algorithm; the worker decrypts in isolation and
/// returns results only. With this condition the "no download path" guarantee is
/// enforced at the CDR layer itself: a consumer's read simply reverts, because
/// only the worker addresses satisfy the gate.
///
/// readConditionData = abi.encode(address[] approvedWorkers)
contract ComputeWorkerReadCondition is IReadCondition {
    function checkReadCondition(
        uint32, /* label */
        bytes calldata, /* accessAuxData */
        bytes calldata readConditionData,
        address caller
    ) external pure returns (bool) {
        address[] memory workers = abi.decode(readConditionData, (address[]));
        for (uint256 i; i < workers.length; ++i) {
            if (workers[i] == caller) {
                return true;
            }
        }
        return false;
    }
}
