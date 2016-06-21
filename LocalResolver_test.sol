import 'dapple/test.sol';
import 'PersonalResolver.sol';
import 'LocalResolver.sol';

contract LocalResolverTest is Test {
    PersonalResolver reg;

    function assertEq(bytes32 a, bytes32 b) {
        assertEq(uint(a), uint(b));
    }

    function setUp() {
        reg = new PersonalResolver();

        reg.setRR(0, "foo.bar.baz", "HA", 3600, 20, bytes32(address(this)));
    }
    
    function testFindResolver() {
        var (rcode, resolver, nodeId) = LocalResolver.findResolver(address(reg), "foo.bar.baz");
        assertEq(uint(rcode), 0);
        assertEq(address(resolver), address(reg));

        (rcode, resolver, nodeId) = LocalResolver.findResolver(address(reg), "florb.bar.baz");
        assertEq(uint(rcode), 3);
    }

    function testResolveOne() {
        var (rcode, rtype, len, data) = LocalResolver.resolveOne(address(reg), "foo.bar.baz", "HA");
        assertEq(uint(rcode), 0);
        assertEq(rtype, "HA");
        assertEq(uint(len), 20);
        assertEq(address(data), address(this));

        (rcode, rtype, len, data) = LocalResolver.resolveOne(address(reg), "florb.bar.baz", "HA");
        assertEq(uint(rcode), 3);
    }

    function testAddr() {
        assertEq(LocalResolver.addr(address(reg), "foo.bar.baz"), address(this));
        assertEq(LocalResolver.addr(address(reg), "florb.bar.baz"), address(0));
    }
}
