pragma solidity ^0.4.18;

import '../ENS.sol';
import './strings.sol';

/**
 * The ENS library.
 */
library ENSLib {
  using strings for *;

  /**
   * @dev Returns the address that owns the specified node.
   * @param node The specified node.
   * @return address of the owner.
   */
  function owner(bytes32 node, address ensAddress) public view returns (address) {
    return ENS(ensAddress).owner(node);
  }

  /**
   * @dev Returns the address of the resolver for the specified node.
   * @param node The specified node.
   * @return address of the resolver.
   */
  function resolver(bytes32 node, address ensAddress) public view returns (address) {
    return ENS(ensAddress).resolver(node);
  }

  /**
   * @dev Returns the TTL of a node, and any records associated with it.
   * @param node The specified node.
   * @return ttl of the node.
   */
  function ttl(bytes32 node, address ensAddress) public view returns (uint64) {
    return ENS(ensAddress).ttl(node);
  }

  /**
   * Get the hash of an ens by his name
   * @param ensName The name of the ens to hash
   */
  function hashname(string ensName) public view returns (bytes32){

    // Split the name in labes
    var s = ensName.toSlice();
    var delim = ".".toSlice();
    var parts = new string[](s.count(delim) + 1);
    for(uint i = 0; i < parts.length; i++) {
        parts[i] = s.split(delim).toString();
    }

    // Generate teh hash from teh labels
    bytes32 nodeHash = bytes32(0);
    bytes32 labelHash;
    for(i = parts.length; i > 0; i--) {
        labelHash = keccak256(parts[i-1]);
        nodeHash = keccak256(nodeHash, labelHash);
    }

    return nodeHash;
  }

}
