# ENS
Implementations for registrars and local resolvers for the Ethereum Name Service

## Resolver.sol
Provides an abstract interface for the methods all ENS resolvers are expected to implement. For details, see the [ENS specification](https://github.com/ethereum/EIPs/issues/137).

## OwnedRegistrar.sol
Provides a functionally complete implementation of an ENS resolver and registrar for individual use. The account that deploys the contract is considered the owner, and is the only party that can update ENS mappings. Simple methods are provided for inserting and updating mappings, as well, as iterating over existing names.

Note that for simplicity, transactions in this implementation include the unhashed names being updated, and these are stored in the state, so it would be straightforward for someone to enumerate your domain.

### appendRR(string name, bytes16 rtype, uint32 ttl, address data)
### appendRR(string name, bytes16 rtype, uint32 ttl, bytes data)

Appends a resource record to a given name. rtype specifies the record type, such as "HA" (which represents an Ethereum address). ttl specifies the time to live for caching of this record, and data specifies the data to associate with the record.

For example, calling `appendRR("foo.bar", "HA", 3600, "0x1234...")` will insert a record that can be returned by the simple `addr` function under the name "foo.bar".

### updateRR(string name, uint idx, bytes16 rtype, uint32 ttl, address data)
### updateRR(string name, uint idx, bytes16 rtype, uint32 ttl, bytes data)

Replaces a resource record on a given name. idx specifies the zero-based index of the resource record to replace. All other arguments are as described in `appendRR`.

### deleteRR(string name, uint idx)

Deletes a resource record under the specified name and zero-based index.

### setSubresolver(string name, uint32 ttl, address addr, bytes12 nodeId)

Adds a node from another ENS resolver as a subresolver under this one. `ttl` specifies the time to live for caching this record; `addr` specifies the address of the target resolver, and `nodeId` specifies the node in the target resolver to reference.

### deleteSubresolver(string name)

Deletes a subresolver record.

### getName(bytes12 nodeId, uint idx)

Permits iteration over the names defined under a node. Returns the `idx`'th name under the specified node, or the empty string if `idx` extends beyond the end of the list.

### getHash(bytes12 nodeId, uint idx)

Permits iteration over the name hashes defined under a node. Returns the `idx`th hash under the specified node, or the empty string if `idx` extends beyond the end of the list.

## LocalResolver.sol
A simple local resolver library to allow contracts to look up other contracts. Gas cost is currently approximately 7000 gas plus 2000 gas per name component.

### resolveOne(address root, string name, bytes16 qtype) returns (uint16 rcode, bytes16 rtype, uint16 len, bytes32 data)
Resolves a name, returning the first matching record. `root` specifies the root resolver to use, `name` specifies the name to look up, and `qtype specifies the record type to query for. Returns the response code, length, and record data.

### addr(address root, string name) returns (string)
Resolves a name, returning the first "HA" record, or the empty string if no such name or record exists.
