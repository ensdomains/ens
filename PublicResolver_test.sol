import 'dapple/test.sol';
import 'ENS.sol';
import 'PublicResolver.sol';

contract InvalidResolver {
    function test();
}

contract PublicResolverTest is Test {
    bytes32 node;
    ENS ens;
    PublicResolver resolver;

    function setUp() {
        node = sha3(bytes32(0), sha3('eth'));
        ens = new ENS(this);
        resolver = new PublicResolver(ens);
    }

    function testSetAddr() {
        assertEq(resolver.has(node, "addr"), false);
        ens.setOwner(0, sha3('eth'), this);
        resolver.setAddr(node, 0x1234);
        assertEq(resolver.addr(node), 0x1234);
        assertEq(resolver.has(node, "addr"), true);
    }

    function testThrowsWhenSettingUnownedAddr() {
        resolver.setAddr(node, 0x1234);
    }

    function testSetContent() {
        assertEq(resolver.has(node, "content"), false);
        ens.setOwner(0, sha3('eth'), this);
        resolver.setContent(node, 0x1234);
        assertEq(uint(resolver.content(node)), 0x1234);
        assertEq(resolver.has(node, "content"), true);
    }

    function testThrowsWhenSettingUnownedContent() {
        resolver.setContent(node, 0x1234);
    }

    function testThrowsWhenFetchingNonexistentAddr() {
        resolver.addr(node);
    }

    function testThrowsWhenFetchingNonexistentContent() {
        resolver.content(node);
    }

    function testThrowsWhenFallbackCalled() {
        InvalidResolver(resolver).test();
    }
}
