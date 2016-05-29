import 'Resolver.sol';
import 'solidity-stringutils/strings.sol';

/**
 * Simple authoritative resolver that allows its owner to insert and update records.
 * This resolver is designed to offer a simple interface that facilitates direct
 * use or updates via a DApp or other tool; as a result, it doesn't make any
 * attempt to prevent enumeration of a domain.
 */
contract OwnedRegistrar is Resolver {
    using strings for *;

    /**************
     * Definitions
     **************/

    uint32 constant DEFAULT_TTL = 3600;

    struct RR {
        bytes16 rtype;
        uint32 ttl;
        uint16 size;
        bytes32 data;
    }

    struct ResolverAddress {
        uint32 ttl;
        bytes12 nodeId;
        address addr;
    }
    
    struct Node {
        mapping (bytes32=>ResolverAddress) subnodes;
        string[] subnodeNames;
        RR[] records;
    }

    address _owner;

    mapping (bytes12=>Node) nodes;
    uint nextNodeId = 1;

    mapping (bytes32=>bytes) extended;
    uint nextExtended = 0;
    
    /*********************
     * Resolver interface
     *********************/

    function findResolver(bytes12 nodeId, bytes32 label) constant
        returns (uint16 rcode, uint32 ttl, bytes12 rnode, address raddress)
    {
        var subnode = nodes[nodeId].subnodes[label];
        if (subnode.addr == address(0)) {
            rcode = RCODE_NXDOMAIN;
            return;
        }
        
        ttl = subnode.ttl;
        rnode = subnode.nodeId;
        raddress = subnode.addr;
    }

    function resolve(bytes12 nodeId, bytes32 qtype, uint16 index) constant
        returns (uint16 rcode, bytes16 rtype, uint32 ttl, uint16 len,
                 bytes32 data)
    {
        var node = nodes[nodeId];
        if (node.subnodeNames.length == 0 && node.records.length == 0) {
            rcode = RCODE_NXDOMAIN;
            return;
        }

        for(uint i = 0; i < node.records.length; i++) {
            var record = node.records[i];
            if (qtype == TYPE_STAR || qtype == record.rtype) {
                if (index > 0) {
                    index--;
                    continue;
                }
                
                rtype = record.rtype;
                ttl = record.ttl;
                len = record.size;
                data = record.data;
                return;
            }
        }
        
        // Returns with rcode=RCODE_OK and len=0, indicates record not found.
        return;
    }

    function getExtended(bytes32 id) constant returns (bytes data) {
        return extended[id];
    }

    /**********************
     * Registrar interface
     **********************/

    modifier owner_only { if (msg.sender != _owner) throw; _ }
    
    function OwnedRegistrar() {
        _owner = msg.sender;
    }
    
    function setOwner(address owner) owner_only {
        _owner = owner;
    }

    function toBytes32(bytes data) private returns (bytes32 ret) {
        assembly {
            ret := mload(add(data, 32))
        }
    }

    function toBytes(bytes32 data) private returns (bytes ret) {
        ret = new bytes(32);
        assembly {
            mstore(add(ret, 32), data)
        }
    }

    function setRR(RR storage rr, bytes16 rtype, uint32 ttl, bytes data) private {
        rr.rtype = rtype;
        rr.ttl = ttl;
        if (data.length > 32) {
            // Use an extended record
            if (rr.size <= 32) {
                rr.data = bytes32(nextExtended++);
            }
            rr.size = uint16(data.length);
            extended[rr.data] = data;
        } else {
            if (rr.size > 32) {
                delete extended[rr.data];
            }
            rr.size = uint16(data.length);
            rr.data = toBytes32(data);
        }
    }

    function findNode(strings.slice name) private returns (Node storage) {
        var node = nodes[0];
        while (!name.empty()) {
            var label = name.rsplit('.'.toSlice());
            if (label.empty())
                throw;
            
            var ra = node.subnodes[label.keccak()];
            if (ra.addr == address(0)) {
                // New subnode
                node.subnodeNames.length += 1;
                node.subnodeNames[node.subnodeNames.length - 1] = label.toString();

                ra.addr = address(this);
                ra.ttl = DEFAULT_TTL;
                ra.nodeId = bytes12(nextNodeId++);
            } else if (ra.addr != address(this)) {
                throw;
            }
            node = nodes[ra.nodeId];
        }
        return node;
    }

    function deleteSubnode(strings.slice name) private {
        var subname = name.split('.'.toSlice());
        var node = findNode(name.copy());

        // Find and delete name
        for (uint i = 0; i < node.subnodeNames.length; i++) {
            if (node.subnodeNames[i].toSlice().equals(subname)) {
                node.subnodeNames[i] = node.subnodeNames[node.subnodeNames.length - 1];
                node.subnodeNames.length -= 1;
                break;
            }
        }

        // Delete subnode
        var hash = subname.keccak();
        delete nodes[node.subnodes[hash].nodeId];
        delete node.subnodes[hash];

        if (node.subnodeNames.length == 0 && node.records.length == 0 && !name.empty())
            deleteSubnode(name);
    }

    /**
     * @dev Appends an RR record to a node.
     * @param name The name to set the record under. The empty name indicates
     *        the root node.
     * @param rtype The record type of the record to insert or update.
     * @param ttl The TTL of the new record.
     * @param data The value of the record
     */
    function appendRR(string name, bytes16 rtype, uint32 ttl, bytes data) owner_only {
        var node = findNode(name.toSlice());
        var idx = node.records.length++;
        setRR(node.records[idx], rtype, ttl, data);
    }

    function appendRR(string name, bytes16 rtype, uint32 ttl, address data) owner_only {
        appendRR(name, rtype, ttl, toBytes(bytes32(data)));
    }

    /**
     * @dev Updates an RR record on a node.
     * @param name The name to set the record under. The empty name indicates
     *        the root node.
     * @param idx The index of the RR to update.
     * @param rtype The record type of the record to insert or update.
     * @param ttl The TTL of the new record.
     * @param data The value of the record
     */
    function updateRR(string name, uint idx, bytes16 rtype, uint32 ttl, bytes data) owner_only {
        var node = findNode(name.toSlice());
        if (node.subnodeNames.length == 0 && node.records.length == 0)
            throw;
        setRR(node.records[idx], rtype, ttl, data);
    }

    function updateRR(string name, uint idx, bytes16 rtype, uint32 ttl, address data) owner_only {
        updateRR(name, idx, rtype, ttl, toBytes(bytes32(data)));
    }

    /**
     * @dev Deletes an RR record.
     * @param name The name to set the record under. The empty name indicates
     *        the root node.
     * @param idx The index of the RR to delete.
     */
    function deleteRR(string name, uint idx) owner_only {
        var node = findNode(name.toSlice());
        if (node.subnodeNames.length == 0 && node.records.length == 0)
            throw;

        var rr = node.records[idx];
        if (rr.size > 32)
            delete extended[rr.data];
        node.records[idx] = node.records[node.records.length - 1];
        node.records.length -= 1;

        if (node.subnodeNames.length == 0 && node.records.length == 0)
            // Node is now empty, delete it.
            deleteSubnode(name.toSlice());
    }

    /**
     * @dev Inserts another resolver as a subnode.
     * @param name The node to insert the resolver as.
     * @param ttl The TTL of this record.
     * @param addr The address of the resolver.
     * @param nodeId The ID of the node to reference on the target resolver.
     */
    function setSubresolver(string name, uint32 ttl, address addr, bytes12 nodeId) owner_only {
        var parent = name.toSlice();
        var label = parent.split(".".toSlice());
        var node = findNode(parent);
        var ra = node.subnodes[label.keccak()];

        if (ra.addr == address(this))
            // Overwriting a local subnode would orphan part of the tree; delete it first!
            throw;
        if (ra.addr == address(0)) {
            // New subnode
            node.subnodeNames.length += 1;
            node.subnodeNames[node.subnodeNames.length - 1] = label.toString();
        }

        ra.ttl = ttl;
        ra.addr = addr;
        ra.nodeId = nodeId;
    }

    /**
     * @dev Deletes another resolver as a subnode.
     * @param name The name of the subresolver node to delete.
     */
    function deleteSubresolver(string name) owner_only {
        var parent = name.toSlice();
        var label = parent.split(".".toSlice());
        var node = findNode(parent);
        var hash = label.keccak();
        var ra = node.subnodes[hash];
        
        if (ra.addr == address(this))
            // Deleting internal nodes would orphan parts of the tree
            throw;
        if (ra.addr == address(0))
            // Not found!
            throw;

        delete node.subnodes[hash];

        for (uint i = 0; i < node.subnodeNames.length; i++) {
            if (node.subnodeNames[i].toSlice().equals(label)) {
                node.subnodeNames[i] = node.subnodeNames[node.subnodeNames.length - 1];
                node.subnodeNames.length -= 1;
                break;
            }
        }

        if (node.subnodeNames.length == 0 && node.records.length == 0 && !parent.empty())
            deleteSubnode(parent);
    }

    /**
     * @dev Retrieves the name of a subnode. If the provided index comes after
     *      the last subnode name, an empty string is returned. Note that any
     *      data-modifying operations on this node will invalidate the iteration
     *      order.
     * @param nodeId The ID of the parent node.
     * @param idx The index of the subnode name.
     * @return The next name, or "" if no more names exist.
     */
    function getName(bytes12 nodeId, uint idx) constant returns (string) {
        var node = nodes[nodeId];
        if (idx >= node.subnodeNames.length) {
            return "";
        }
        return node.subnodeNames[idx];
    }

    /**
     * @dev Retrieves the name hash of a subnode. If the provided index comes
     *      after the last subnode hash, an empty string is returned. Note that
     *      any data-modifying operations on this node will invalidate the
     *      iteration order.
     * @param nodeId The ID of the parent node.
     * @param idx The index of the subnode name.
     * @return The next name hash, or 0 if no more names exist.
     */
    function getHash(bytes12 nodeId, uint idx) constant returns (bytes32) {
        var node = nodes[nodeId];
        if (idx >= node.subnodeNames.length) {
            return bytes32(0);
        }
        return sha3(node.subnodeNames[idx]);
    }
}
