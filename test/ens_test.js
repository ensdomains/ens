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
	ensTests('ENS.sol', utils.deployENS);
});

describe('ENS.lll', function() {
	ensTests('ENS.lll', utils.deployENSLLL);
});

function getEventsForTx(event, txid, cb) {
	web3.eth.getTransaction(txid, function(err, tx) {
		if (err != null) {
			cb(err, null);
		} else {
			event({}, {fromBlock: tx.blockNumber, toBlock: tx.blockNumber}).get(cb);
		}
	});
}

function ensTests(label, deploy) {
	var ens = null;
	var txids = [];

	beforeEach(function(done) {
		this.timeout(10000);
		ens = deploy(accounts[0], done);
	});

	after(function(done) {
		async.map(txids, web3.eth.getTransactionReceipt, function(err, receipts) {
			var gas = 0;
			for(var i = 0; i < receipts.length; i++)
				gas += receipts[i].gasUsed - 21000;
			console.log("Gas report for " + label + ": " + gas);
			done();
		});
	});

	it("transfers ownership", function(done) {
		ens.setOwner(0, "0x1234", {from: accounts[0]}, function(err, txid) {
			txids.push(txid);
			assert.equal(err, null, err);
			ens.owner(0, function(err, owner) {
				assert.equal(owner, "0x0000000000000000000000000000000000001234");
				getEventsForTx(ens.Transfer, txid, function(err, logs) {
					assert.equal(err, null, err);
					assert.equal(logs.length, 1);
					var args = logs[0].args;
					assert.equal(args.node, "0x0000000000000000000000000000000000000000000000000000000000000000");
					assert.equal(args.owner, "0x0000000000000000000000000000000000001234");
					done();
				});
			});
		});
	});

	it("prohibits transfers by non-owners", function(done) {
		ens.setOwner(1, "0x1234", {from: accounts[0]}, function(err, result) {
			assert.ok(err, err);
			ens.owner(1, function(err, owner) {
				assert.equal(owner, "0x0000000000000000000000000000000000000000");
			});
			done();
		});
	});

	it("sets resolvers", function(done) {
		ens.setResolver(0, "0x1234", {from: accounts[0]}, function(err, txid) {
			txids.push(txid);
			assert.equal(err, null, err);
			ens.resolver(0, function(err, resolver) {
				assert.equal(resolver, "0x0000000000000000000000000000000000001234");
				getEventsForTx(ens.NewResolver, txid, function(err, logs) {
					assert.equal(err, null, err);
					assert.equal(logs.length, 1);
					var args = logs[0].args;
					assert.equal(args.node, "0x0000000000000000000000000000000000000000000000000000000000000000");
					assert.equal(args.resolver, "0x0000000000000000000000000000000000001234");
					done();
				});
			});
		});
	});

	it("prohibits setting resolver by non-owners", function(done) {
		ens.setResolver(1, "0x1234", {from: accounts[0]}, function(err, result) {
			assert.ok(err, err);
			ens.resolver(1, function(err, resolver) {
				assert.equal(resolver, "0x0000000000000000000000000000000000000000");
				done();
			});
		});
	});

	it("permits setting TTL", function(done) {
		ens.setTTL(0, 3600, {from: accounts[0]}, function(err, txid) {
			txids.push(txid);
			assert.equal(err, null, err);
			ens.ttl(0, function(err, ttl) {
				assert.equal(ttl.toNumber(), 3600);
				getEventsForTx(ens.NewTTL, txid, function(err, logs) {
					assert.equal(err, null, err);
					assert.equal(logs.length, 1);
					var args = logs[0].args;
					assert.equal(args.node, "0x0000000000000000000000000000000000000000000000000000000000000000");
					assert.equal(args.ttl.toNumber(), 3600);
					done();
				});
			});
		});
	});

	it("prohibits setting TTL by non-owners", function(done) {
		ens.setTTL(1, 3600, {from: accounts[0]}, function(err, result) {
			assert.ok(err, err);
			ens.ttl(1, function(err, ttl) {
				assert.equal(ttl.toNumber(), 0);
				done();
			});
		});
	});

	it("creates subnodes", function(done) {
		ens.setSubnodeOwner(0, web3.sha3('eth'), accounts[1], {from: accounts[0]}, function(err, txid) {
			txids.push(txid);
			assert.equal(err, null);
			ens.owner(utils.node, function(err, owner) {
				assert.equal(owner, accounts[1]);
				getEventsForTx(ens.NewOwner, txid, function(err, logs) {
					assert.equal(err, null, err);
					assert.equal(logs.length, 1);
					var args = logs[0].args;
					assert.equal(args.node, "0x0000000000000000000000000000000000000000000000000000000000000000");
					assert.equal(args.label, web3.sha3('eth'));
					assert.equal(args.owner, accounts[1]);
					done();
				});
			});
		});
	});

	it("prohibits subnode creation by non-owners", function(done) {
		ens.setSubnodeOwner(0, web3.sha3('eth'), accounts[1], {from: accounts[1]}, function(err, result) {
			assert.ok(err, err);
			ens.owner(utils.node, function(err, owner) {
				assert.equal(owner, "0x0000000000000000000000000000000000000000");
				done();
			});
		});
	});
}
