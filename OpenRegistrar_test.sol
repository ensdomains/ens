import 'dapple/test.sol';
import 'OpenRegistrar.sol';
import 'PersonalResolver.sol';

contract OpenRegistrarTest is Test {
	OpenRegistrar reg;

	function setUp() {
		reg = new OpenRegistrar();
	}

	function testThrowOnExistingDomain() {
		var pr = new PersonalResolver(address(this));
		reg.register(sha3("foo"), pr, 0);
		reg.register(sha3("foo"), pr, 0);
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
		var pr = new PersonalResolver(address(this));
		reg.register(sha3("foo"), pr, 0);
		reg.setOwner(sha3("foo"), address(reg));
		assertEq(reg.getOwner(sha3("foo")), address(reg));
	}

	function testThrowOnTransferFromNonOwner() {
		var pr = new PersonalResolver(address(this));
		reg.register(sha3("foo"), pr, 0);
		reg.setOwner(sha3("foo"), address(reg));
		reg.setOwner(sha3("foo"), address(this));
	}

	function testThrowOnTransferToZero() {
		var pr = new PersonalResolver(address(this));
		reg.register(sha3("foo"), pr, 0);
		reg.setOwner(sha3("foo"), address(0));
	}

	function testSetResolver() {
		var pr = new PersonalResolver(address(this));
		reg.register(sha3("foo"), pr, 0);
		var pr2 = new PersonalResolver(address(this));
		reg.setResolver(sha3("foo"), pr2, 0);
		var (rcode, ttl, rnode, raddress) = reg.findResolver(0, sha3("foo"));
		assertEq(uint(rcode), 0);
		assertEq(uint(ttl), 3600);
		assertEq(raddress, address(pr2));
		assertEq(uint(rnode), 0);
	}

	function testThrowOnSetResolverFromNonOwner() {
		var pr = new PersonalResolver(address(this));
		reg.register(sha3("foo"), pr, 0);
		reg.setOwner(sha3("foo"), address(reg));
		reg.setResolver(sha3("foo"), address(this), 0);
	}

	function testThrowOnSetResolverToZero() {
		var pr = new PersonalResolver(address(this));
		reg.register(sha3("foo"), pr, 0);
		reg.setResolver(sha3("foo"), address(0), 0);
	}
}
