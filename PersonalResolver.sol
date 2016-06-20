import "Resolver.sol";
import "solidity-stringutils/strings.sol";

/**
 * A simple ENS resolver contract for individual use, that allows its owner to
 * establish name mappings. Only supports one RR per name, and does not support
 * extended records or delegation to other resolvers.
 */
contract PersonalResolver is Resolver {
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

    struct Node {
        RR record;
        // Count of direct subnodes (plus one for this node)
        uint nodeCount;
        string[] subnodeLabels;
    }

    address _owner;

    mapping (bytes12=>Node) nodes;

    function getSubnodeId(bytes12 nodeId, bytes32 label) private constant returns (bytes12 subnodeId) {
        subnodeId = bytes12(sha3(nodeId, label));
    }
    
    function findResolver(bytes12 nodeId, bytes32 label) constant
        returns (uint16 rcode, uint32 ttl, bytes12 rnode, address raddress)
    {
        rnode = getSubnodeId(nodeId, label);
        var subnode = nodes[rnode];
        if (subnode.nodeCount == 0) {
            rcode = RCODE_NXDOMAIN;
            return;
        }
        
        ttl = DEFAULT_TTL;
        raddress = address(this);
    }
    
    function resolve(bytes12 nodeId, bytes32 qtype, uint16 index) constant
        returns (uint16 rcode, bytes16 rtype, uint32 ttl, uint16 len,
                 bytes32 data)
    {
        if (index > 0) {
            return;
        }

        var node = nodes[nodeId];
        if (node.nodeCount == 0) {
            rcode = RCODE_NXDOMAIN;
            return;
        }

        var record = node.record;
        if (qtype == TYPE_STAR || qtype == record.rtype) {
            rtype = record.rtype;
            ttl = record.ttl;
            len = record.size;
            data = record.data;
            return;
        }

        // Returns with rcode=RCODE_OK and len=0, indicates record not found.
        return;
    }
    
    function getExtended(bytes32 id) constant returns (bytes data) {
        return "";
    }

    modifier owner_only { if (msg.sender != _owner) throw; _ }
    
    function PersonalResolver() {
        _owner = msg.sender;
        nodes[0].nodeCount = 1;
    }
    
    function setOwner(address owner) owner_only {
        _owner = owner;
    }

    function setRR(RR storage rr, bytes16 rtype, uint32 ttl, uint16 len, bytes32 data) private {
        if (data.length > 32)
            throw;
        rr.rtype = rtype;
        rr.ttl = ttl;
        rr.size = len;
        rr.data = data;
    }

    function findNode(strings.slice name) private returns (bytes12 id, Node storage) {
        bytes12 nodeId = 0;
        var dot = '.'.toSlice();
        while (!name.empty()) {
            var label = name.rsplit(dot);
            if (label.empty())
                throw;
            
            var subnodeId = getSubnodeId(nodeId, label.keccak());
            var node = nodes[subnodeId];
            if (node.nodeCount == 0) {
                // New subnode
                node.subnodeLabels.length += 1;
                node.subnodeLabels[node.subnodeLabels.length - 1] = label.toString();
                node.nodeCount = 1;
                nodes[nodeId].nodeCount += 1;
            }
            nodeId = subnodeId;
        }
        return (nodeId, nodes[nodeId]);
    }
    
    function findNode(bytes32[] name, uint start, uint len) private returns (bytes12 id, Node storage) {
        bytes12 nodeId = 0;
        for(int i = int(start + len - 1); i >= int(start); i--) {
            var subnodeId = getSubnodeId(nodeId, name[uint(i)]);
            var node = nodes[subnodeId];
            if (node.nodeCount == 0) {
                node.nodeCount = 1;
                nodes[nodeId].nodeCount += 1;
            }
            nodeId = subnodeId;
        }
        return (nodeId, nodes[nodeId]);
    }
    
    function deleteSubnode(strings.slice name) private {
        var label = name.split('.'.toSlice());
        var (nodeId, node) = findNode(name.copy());

        // Find and delete name
        var len = node.subnodeLabels.length;
        for (uint i = 0; i < len; i++) {
            if (node.subnodeLabels[i].toSlice().equals(label)) {
                node.subnodeLabels[i] = node.subnodeLabels[len - 1];
                node.subnodeLabels.length -= 1;
                break;
            }
        }

        // Delete subnode
        var hash = label.keccak();
        delete nodes[getSubnodeId(nodeId, hash)];
        node.nodeCount -= 1;

        if (node.nodeCount == 1 && node.record.rtype == 0 && !name.empty())
            deleteSubnode(name);
    }

    function deletePrivateSubnode(bytes32[] name, uint start, uint len) private {
        var (nodeId, node) = findNode(name, start + 1, len - 1);

        // Delete subnode
        delete nodes[getSubnodeId(nodeId, name[0])];
        node.nodeCount -= 1;

        if (node.nodeCount == 1 && node.record.rtype == 0 && len > 1)
            deletePrivateSubnode(name, start + 1, len - 1);
    }

    /**
     * @dev Sets the RR for a node. This resoler only supports one RR per node.
     * @param name The name to set the record under. The empty name indicates
     *        the root node.
     * @param rtype The record type of the record to set.
     * @param ttl The TTL of the new record.
     * @param data The value of the record. Must be <=32 bytes.
     */
    function setRR(string name, bytes16 rtype, uint32 ttl, uint16 len, bytes32 data) owner_only {
        var (nodeId, node) = findNode(name.toSlice());
        setRR(node.record, rtype, ttl, len, data);
    }

    /**
     * @dev Sets the RR for a node without recording its preimage. This resolver only
     * supports one RR per node.
     * @param name The list of label hashes to set the record under. The empty
     *        array indicates the root node.
     * @param rtype The record type of the record to set.
     * @param ttl The TTL of the new record.
     * @param data The value of the record. Must be <=32 bytes.
     */
    function setPrivateRR(bytes32[] name, bytes16 rtype, uint32 ttl, uint16 len, bytes32 data) owner_only {
        var (nodeId, node) = findNode(name, 0, name.length);
        setRR(node.record, rtype, ttl, len, data);
    }

    /**
     * @dev Deletes an RR record.
     * @param name The name of the record to delete. The empty name indicates
     *        the root node.
     */
    function deleteRR(string name) owner_only {
        var (nodeId, node) = findNode(name.toSlice());
        if (node.nodeCount == 0)
            throw;

        if (node.nodeCount > 1) {
            // This node has subnodes, so just zero out the RR.
            setRR(node.record, 0, 0, 0, "");
        } else {
            // No subnodes - delete this node.
            deleteSubnode(name.toSlice());
        }
    }

    /**
     * @dev Deletes an RR record.
     * @param name The list of label hashes of the node to delete the RR from.
     *        The empty name indicates the root node.
     */
    function deletePrivateRR(bytes32[] name) owner_only {
        var (nodeId, node) = findNode(name, 0, name.length);
        if (node.nodeCount == 0)
            throw;

        if (node.nodeCount > 1) {
            // This node has subnodes, so just zero out the RR.
            setRR(node.record, 0, 0, 0, "");
        } else {
            // No subnodes - delete this node.
            deletePrivateSubnode(name, 0, name.length);
        }
    }
}
