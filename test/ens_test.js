var assert = require('assert');
var async = require('async');

var utils = require('./utils.js');
var web3 = utils.web3;

var accounts = null;

before(function(done) {
	web3.eth.getAccounts(function(err, acct) {
		accounts = acct
		done();
	});
});

describe('ENS.sol', function() {
	ensTests(utils.deployENS);
});

describe('ENS.lll', function() {
	ensTests(utils.deployENSLLL);
});

function ensTests(deploy) {
	var ens = null;

	beforeEach(function(done) {
		this.timeout(10000);
		ens = deploy(accounts[0], done);
	});

	it("transfers ownership", function(done) {
		ens.setOwner(0, "0x1234", {from: accounts[0]}, function(err, result) {
			assert.equal(err, null, err);
			ens.owner(0, function(err, owner) {
				assert.equal(owner, "0x0000000000000000000000000000000000001234");
				done();
			});
		});
	});

	it("prohibits transfers by non-owners", function(done) {
		ens.setOwner(1, "0x1234", {from: accounts[0]}, function(err, result) {
			assert.ok(err.toString().indexOf(utils.INVALID_JUMP) != -1, err);
			ens.owner(1, function(err, owner) {
				assert.equal(owner, "0x0000000000000000000000000000000000000000");
			});
			done();
		});
	});

	it("sets resolvers", function(done) {
		ens.setResolver(0, "0x1234", {from: accounts[0]}, function(err, result) {
			assert.equal(err, null, err);
			ens.resolver(0, function(err, resolver) {
				assert.equal(resolver, "0x0000000000000000000000000000000000001234");
				done();
			});
		});
	});

	it("prohibits setting resolver by non-owners", function(done) {
		ens.setResolver(1, "0x1234", {from: accounts[0]}, function(err, result) {
			assert.ok(err.toString().indexOf(utils.INVALID_JUMP) != -1, err);
			ens.resolver(1, function(err, resolver) {
				assert.equal(resolver, "0x0000000000000000000000000000000000000000");
				done();
			});
		});
	});

	it("permits setting TTL", function(done) {
		ens.setTTL(0, 3600, {from: accounts[0]}, function(err, result) {
			assert.equal(err, null, err);
			ens.ttl(0, function(err, ttl) {
				assert.equal(ttl.toNumber(), 3600);
				done();
			});
		});
	});

	it("prohibits setting TTL by non-owners", function(done) {
		ens.setTTL(1, 3600, {from: accounts[0]}, function(err, result) {
			assert.ok(err.toString().indexOf(utils.INVALID_JUMP) != -1, err);
			ens.ttl(1, function(err, ttl) {
				assert.equal(ttl.toNumber(), 0);
				done();
			});
		});
	});

	it("creates subnodes", function(done) {
		ens.setSubnodeOwner(0, web3.sha3('eth'), accounts[1], {from: accounts[0]}, function(err, result) {
			assert.equal(err, null);
			ens.owner(utils.node, function(err, owner) {
				assert.equal(owner, accounts[1]);
				done();
			});
		});
	});

	it("prohibits subnode creation by non-owners", function(done) {
		ens.setSubnodeOwner(0, web3.sha3('eth'), accounts[1], {from: accounts[1]}, function(err, result) {
			assert.ok(err.toString().indexOf(utils.INVALID_JUMP) != -1, err);
			ens.owner(utils.node, function(err, owner) {
				assert.equal(owner, "0x0000000000000000000000000000000000000000");
				done();
			});
		});
	});
}
