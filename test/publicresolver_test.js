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

describe('PublicResolver', function() {
	var resolverCode = null;
	var resolver = null;
	var ens = null;


	before(function() {
		this.timeout(10000);
		resolverCode = utils.compileContract(['interface.sol', 'PublicResolver.sol']).contracts['PublicResolver.sol:PublicResolver'];
	});

	beforeEach(function(done) {
		async.series([
			function(done) { ens = utils.deployENS(accounts[0], done); },
			function(done) {
				resolver = web3.eth.contract(JSON.parse(resolverCode.interface)).new(
				    ens.address,
				    {
				    	from: accounts[0],
				     	data: resolverCode.bytecode,
				     	gas: 4700000
				   	}, function(err, contract) {
				   	    assert.equal(err, null, err);
				   	    if(contract.address != undefined) {
				   	    	ens.setSubnodeOwner(0, web3.sha3('eth'), accounts[0], {from: accounts[0]}, done);
					   	}
				   });
			}],
			done
		);
	});

	it('permits setting addresses', function(done) {
		async.series([
			function(done) { resolver.supportsInterface("0x3b3b57de", function(err, result) {
					assert.equal(err, null, err);
					assert.equal(result, true);
					done();
				});
			},
			function(done) { resolver.setAddr(utils.node, accounts[1], {from: accounts[0]}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
			},
			function(done) { resolver.addr(utils.node, function(err, address) {
					assert.equal(err, null, err);
					assert.equal(address, accounts[1]);
					done();
				});
			}],
			done
		);
	});

	it('forbids setting addresses by non-owners', function(done) {
		resolver.setAddr(utils.node, accounts[1], {from: accounts[1]}, function(err, tx) {
			assert.ok(err.toString().indexOf(utils.INVALID_JUMP) != -1, err);
			done();
		});
	});

	it('returns zero when fetching nonexistent addresses', function(done) {
		resolver.addr(utils.node, function(err, result) {
			assert.equal(err, null, err);
			assert.equal(result, "0x0000000000000000000000000000000000000000");
			done();
		});
	});
});
