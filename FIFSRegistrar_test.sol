import 'dapple/test.sol';
import 'ENS.sol';
import 'FIFSRegistrar.sol';

contract FIFSRegistrarTest is Test {
	ENS ens;
	FIFSRegistrar registrar;
	bytes32 node;

	function setUp() {
		node = sha3(bytes32(0), sha3('eth'));
		ens = new ENS(this);
		registrar = new FIFSRegistrar(ens, 0);
		ens.setOwner(0, registrar);
	}

	function testRegisterName() {
		registrar.register(sha3('eth'), this);
		assertEq(registrar, ens.owner(0));
		assertEq(this, ens.owner(node));
	}

	function testTransferName() {
		registrar.register(sha3('eth'), this);
		registrar.register(sha3('eth'), 0x12345);
		assertEq(0x12345, ens.owner(node));
	}

	function testThrowWhenReregisteringName() {
		registrar.register(sha3('eth'), 0x12345);
		registrar.register(sha3('eth'), this);
	}
}
