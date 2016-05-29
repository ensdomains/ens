import 'dapple/test.sol';
import 'OwnedRegistrar.sol';
import 'LocalResolver.sol';

contract LocalResolverTest is Test {
    OwnedRegistrar reg1;
    OwnedRegistrar reg2;

    function assertEq(bytes32 a, bytes32 b) {
        assertEq(uint(a), uint(b));
    }

    function setUp() {
        reg1 = new OwnedRegistrar();
        reg2 = new OwnedRegistrar();

        reg1.setSubresolver("bar.baz", 3600, address(reg2), 0);
        reg2.appendRR("foo", "HA", 3600, address(this));
    }
    
    function testFindResolver() {
        var (rcode, resolver, nodeId) = LocalResolver.findResolver(address(reg1), "foo.bar.baz");
        assertEq(uint(rcode), 0);
        assertEq(address(resolver), address(reg2));

        (rcode, resolver, nodeId) = LocalResolver.findResolver(address(reg1), "florb.bar.baz");
        assertEq(uint(rcode), 3);
    }

    function testResolveOne() {
        var (rcode, rtype, len, data) = LocalResolver.resolveOne(address(reg1), "foo.bar.baz", "HA");
        assertEq(uint(rcode), 0);
        assertEq(rtype, "HA");
        assertEq(uint(len), 32);
        assertEq(address(data), address(this));

        (rcode, rtype, len, data) = LocalResolver.resolveOne(address(reg1), "florb.bar.baz", "HA");
        assertEq(uint(rcode), 3);
    }

    function testAddr() {
        assertEq(LocalResolver.addr(address(reg1), "foo.bar.baz"), address(this));
        assertEq(LocalResolver.addr(address(reg1), "florb.bar.baz"), address(0));
    }
}
