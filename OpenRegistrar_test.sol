import 'dapple/test.sol';
import 'OpenRegistrar.sol';
import 'PersonalResolver.sol';

contract OpenRegistrarTest is Test {
	OpenRegistrar reg;

	function setUp() {
		reg = new OpenRegistrar();
	}

	function testRegister() {
		reg.register(sha3("foo"));
		var (rcode, ttl, rnode, raddress) = reg.findResolver(0, sha3("foo"));
		assertEq(uint(rcode), 0);
		assertEq(uint(ttl), 3600);
		assertEq(PersonalResolver(raddress).owner(), address(this));
		assertEq(uint(rnode), 0);
		assertEq(reg.getOwner(sha3("foo")), address(this));
	}

	function testThrowOnExistingDomain() {
		reg.register(sha3("foo"));
		reg.register(sha3("foo"));
	}

	function testRegisterWithResolver() {
		var pr = new PersonalResolver(address(this));
		reg.register(sha3("foo"), pr, 0);
		var (rcode, ttl, rnode, raddress) = reg.findResolver(0, sha3("foo"));
		assertEq(uint(rcode), 0);
		assertEq(uint(ttl), 3600);
		assertEq(raddress, address(pr));
		assertEq(uint(rnode), 0);
		assertEq(reg.getOwner(sha3("foo")), address(this));
	}

	function testTransfer() {
		reg.register(sha3("foo"));
		reg.setOwner(sha3("foo"), address(reg));
		assertEq(reg.getOwner(sha3("foo")), address(reg));
	}

	function testThrowOnTransferFromNonOwner() {
		reg.register(sha3("foo"));
		reg.setOwner(sha3("foo"), address(reg));
		reg.setOwner(sha3("foo"), address(this));
	}

	function testThrowOnTransferToZero() {
		reg.register(sha3("foo"));
		reg.setOwner(sha3("foo"), address(0));
	}

	function testSetResolver() {
		reg.register(sha3("foo"));
		var pr = new PersonalResolver(address(this));
		reg.setResolver(sha3("foo"), pr, 0);
		var (rcode, ttl, rnode, raddress) = reg.findResolver(0, sha3("foo"));
		assertEq(uint(rcode), 0);
		assertEq(uint(ttl), 3600);
		assertEq(raddress, address(pr));
		assertEq(uint(rnode), 0);
	}

	function testThrowOnSetResolverFromNonOwner() {
		reg.register(sha3("foo"));
		reg.setOwner(sha3("foo"), address(reg));
		reg.setResolver(sha3("foo"), address(this), 0);
	}

	function testThrowOnSetResolverToZero() {
		reg.register(sha3("foo"));
		reg.setResolver(sha3("foo"), address(0), 0);
	}
}
