import 'dapple/test.sol';
import 'OwnedRegistrar.sol';

contract RegistrarTest is Test {
    OwnedRegistrar reg;

    function setUp() {
        reg = new OwnedRegistrar();
    }

    function assertEq(bytes32 a, bytes32 b) {
        assertEq(uint(a), uint(b));
    }

    function testResourceRecords() {
        // Insert and retrieve a basic record
        reg.appendRR("", "HA", 3600, address(this));
        var (rcode, rtype, ttl, len, data) = reg.resolve(0, "HA", 0);
        assertEq(uint(rcode), 0);
        assertEq(rtype, "HA");
        assertEq(uint(ttl), 3600);
        assertEq(uint(len), 32);
        assertEq(data, bytes32(address(this)));

        // Insert and retrieve a record on a subnode
        reg.appendRR("foo.bar", "HA", 3600, "Foo");
        bytes12 rnode;
        address raddress;
        (rcode, ttl, rnode, raddress) = reg.findResolver(0, sha3("bar"));
        assertEq(uint(rcode), 0);
        assertEq(uint(ttl), 3600);
        assertEq(raddress, address(reg));
        (rcode, ttl, rnode, raddress) = reg.findResolver(rnode, sha3("foo"));
        (rcode, rtype, ttl, len, data) = reg.resolve(rnode, "HA", 0);
        assertEq(data, bytes32("Foo"));

        // Append a second record
        reg.appendRR("foo.bar", "HA", 3600, "Bar");
        (rcode, rtype, ttl, len, data) = reg.resolve(rnode, "HA", 1);
        assertEq(data, bytes32("Bar"));

        // Update a record
        reg.updateRR("foo.bar", 0, "HA", 3600, "Baz");
        (rcode, rtype, ttl, len, data) = reg.resolve(rnode, "HA", 0);
        assertEq(data, bytes32("Baz"));

        // Delete a record
        reg.deleteRR("foo.bar", 0);
        (rcode, rtype, ttl, len, data) = reg.resolve(rnode, "HA", 0);
        assertEq(data, bytes32("Bar"));

        // Delete the last record
        reg.deleteRR("foo.bar", 0);
        (rcode, rtype, ttl, len, data) = reg.resolve(rnode, "HA", 0);
        assertEq(uint(rcode), 3); // NXDOMAIN
        (rcode, ttl, rnode, raddress) = reg.findResolver(0, sha3("bar"));
        assertEq(uint(rcode), 3); // NXDOMAIN
    }

    function testSubnodes() {
        // Insert a subnode
        reg.setSubresolver("foo.bar", 3600, address(this), 1);
        var (rcode, ttl, rnode, raddress) = reg.findResolver(0, sha3("bar"));
        assertEq(uint(rcode), 0);
        assertEq(uint(ttl), 3600);
        assertEq(raddress, address(reg));
        bytes12 rnode2;
        (rcode, ttl, rnode2, raddress) = reg.findResolver(rnode, sha3("foo"));
        assertEq(uint(rcode), 0);
        assertEq(uint(ttl), 3600);
        assertEq(uint(rnode2), 1);
        assertEq(raddress, address(this));

        // Update a subnode
        reg.setSubresolver("foo.bar", 3600, address(123), 2);
        (rcode, ttl, rnode2, raddress) = reg.findResolver(rnode, sha3("foo"));
        assertEq(uint(rnode2), 2);
        assertEq(raddress, address(123));

        // Insert an RR under "bar", and verify deleting "foo.bar" doesn't delete it
        reg.appendRR("bar", "HA", 3600, "Bar");
        reg.deleteSubresolver("foo.bar");
        (rcode, ttl, rnode, raddress) = reg.findResolver(0, sha3("bar"));
        assertEq(uint(rcode), 0);
        (rcode, ttl, rnode, raddress) = reg.findResolver(rnode, sha3("foo"));
        assertEq(uint(rcode), 3);
    }

    function testGetHash() {
        reg.setSubresolver("foo", 3600, address(123), 1);
        reg.appendRR("bar", "HA", 3600, "Bar");
        assertEq(reg.getHash(0, 0), sha3("foo"));
        assertEq(reg.getHash(0, 1), sha3("bar"));
        assertEq(reg.getHash(0, 2), bytes32(0));
    }
}