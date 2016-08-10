import 'dapple/test.sol';
import 'ENS.sol';

contract ENSTest is Test {
    event NewOwner(bytes32 indexed node, bytes32 indexed label, address owner);
    event Transfer(bytes32 indexed node, address owner);
    event NewResolver(bytes32 indexed node, address resolver);

    ENS ens;

    function setUp() {
        ens = new ENS(this);
    }

    function testRegisterSubnode() {
        expectEventsExact(ens);
        var node = sha3(bytes32(0), sha3('eth'));

        NewOwner(0, sha3('eth'), 0x1234);
        ens.setOwner(0, sha3('eth'), 0x1234);
        assertEq(0x1234, ens.owner(node));

        NewOwner(0, sha3('eth'), 0x1235);
        ens.setOwner(0, sha3('eth'), 0x1235);
        assertEq(0x1235, ens.owner(node));
    }

    function testChangeOwner() {
        expectEventsExact(ens);

        Transfer(0, 0x1234);
        ens.setOwner(0, 0x1234);
        assertEq(0x1234, ens.owner(0));
    }

    function testSetResolver() {
        expectEventsExact(ens);

        var node = sha3(bytes32(0), sha3('eth'));
        NewOwner(0, sha3('eth'), this);
        ens.setOwner(0, sha3('eth'), this);
        NewResolver(node, 0x1234);
        ens.setResolver(node, 0x1234);
        assertEq(0x1234, ens.resolver(node));
    }

    function testThrowWhenIllegallySettingOwner() {
        ens.setOwner(0x1234, this);
    }

    function testThrowWhenIllegallySettingResolver() {
        ens.setResolver(0x1234, this);
    }
}
