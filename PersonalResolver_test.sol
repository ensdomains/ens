import 'dapple/test.sol';
import 'PersonalResolver.sol';

contract PersonalResolverTest is Test {
    PersonalResolver reg;

    function setUp() {
        reg = new PersonalResolver();
    }

    function assertEq(bytes32 a, bytes32 b) {
        assertEq(uint(a), uint(b));
    }

    function testResourceRecords() {
        // Insert and retrieve a basic record
        reg.setRR(0, "", "HA", 3600, 20, bytes32(address(this)));
        var (rcode, rtype, ttl, len, data) = reg.resolve(0, "HA", 0);
        assertEq(uint(rcode), 0);
        assertEq(rtype, "HA");
        assertEq(uint(ttl), 3600);
        assertEq(uint(len), 20);
        assertEq(data, bytes32(address(this)));

        // Insert and retrieve a record on a subnode
        reg.setRR(0, "foo.bar", "HA", 3600, 3, "Foo");
        bytes12 rnode;
        address raddress;
        (rcode, ttl, rnode, raddress) = reg.findResolver(0, sha3("bar"));
        assertEq(uint(rcode), 0);
        assertEq(uint(ttl), 3600);
        assertEq(raddress, address(reg));
        (rcode, ttl, rnode, raddress) = reg.findResolver(rnode, sha3("foo"));
        (rcode, rtype, ttl, len, data) = reg.resolve(rnode, "HA", 0);
        assertEq(data, bytes32("Foo"));

        // Update a record
        reg.setRR(0, "foo.bar", "HA", 3600, 3, "Baz");
        (rcode, rtype, ttl, len, data) = reg.resolve(rnode, "HA", 0);
        assertEq(data, bytes32("Baz"));

        // Delete a record
        reg.deleteRR(0, "foo.bar");
        (rcode, rtype, ttl, len, data) = reg.resolve(rnode, "HA", 0);
        assertEq(uint(rcode), 3); // NXDOMAIN
        (rcode, ttl, rnode, raddress) = reg.findResolver(0, sha3("bar"));
        assertEq(uint(rcode), 3); // NXDOMAIN
    }

    // Tests that deleting a node doesn't delete parent nodes that have private RRs.
    function testReferenceCounting() {
        reg.setRR(0, "foo.bar", "HA", 3600, 3, "Foo");
        bytes32[] memory labels = new bytes32[](2);
        labels[0] = sha3("baz");
        labels[1] = sha3("bar");
        reg.setPrivateRR(0, labels, "HA", 3600, 3, "Baz");
        
        reg.deleteRR(0, "foo.bar");
        var (rcode, ttl, rnode, raddress) = reg.findResolver(0, sha3("bar"));
        assertEq(uint(rcode), 0);

        reg.deletePrivateRR(0, labels);
        (rcode, ttl, rnode, raddress) = reg.findResolver(0, sha3("bar"));
        (rcode, ttl, rnode, raddress) = reg.findResolver(rnode, sha3("baz"));
        assertEq(uint(rcode), 3); // NXDOMAIN
    }
}
