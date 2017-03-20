
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

describe('SimpleHashRegistrar', function() {
	var registrarABI = null;
	var registrarBytecode = null;
	var deedABI = null;
	var registrar = null;
	var ens = null;

	var dotEth = web3.sha3('0000000000000000000000000000000000000000000000000000000000000000' + web3.sha3('eth').slice(2), {encoding: 'hex'});
	var nameDotEth = web3.sha3(dotEth + web3.sha3('name').slice(2), {encoding: 'hex'});

	before(function() {
		this.timeout(30000);
		var code = utils.compileContract(['interface.sol', 'HashRegistrarSimplified.sol']);
		registrarABI = JSON.parse(code.contracts['HashRegistrarSimplified.sol:Registrar'].interface);
		registrarBytecode = code.contracts['HashRegistrarSimplified.sol:Registrar'].bytecode;
		deedABI = JSON.parse(code.contracts['HashRegistrarSimplified.sol:Deed'].interface);
	});

	beforeEach(function(done) {
		this.timeout(5000);
		async.series([
			function(done) { ens = utils.deployENS(accounts[0], done); },
			function(done) {
				registrar = web3.eth.contract(registrarABI).new(
				    ens.address,
				    dotEth,
				    0,
				    {
				    	from: accounts[0],
				     	data: registrarBytecode,
				     	gas: 4700000
				   	}, function(err, contract) {
				   	    assert.equal(err, null, err);
				   	    if(contract.address != undefined) {
				   	    	done();
					   	}
				   });
			},
			function(done) { ens.setSubnodeOwner(0, web3.sha3('eth'), registrar.address, {from: accounts[0]}, done);}
		], done);
	});

	it('starts auctions', function(done) {
		async.series([
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, done);
			},
			function(done) {
				registrar.entries(web3.sha3('name'), function(err, result) {
					assert.equal(err, null, err);
					assert.equal(result[0], 1); // status == Auction
					assert.equal(result[1], 0); // deed == 0x00
					var dateDiff = Math.abs(result[2].toNumber() - new Date().getTime() / 1000 - 28 * 24 * 60 * 60);
					assert.ok(dateDiff < 5, dateDiff); // registrationDate
					assert.equal(result[3], 0); // value = 0
					assert.equal(result[4], 0); // highestBid = 0
					done();
				});
			}
		], done);
	});

	it('records bids', function(done) {
		var bid = null;
		async.series([
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, done);
			},
			function(done) {
				registrar.shaBid(web3.sha3('name'), accounts[0], 1e18, 0, function(err, result) {
					bid = result;
					assert.equal(err, null, err);
					registrar.newBid(bid, {from: accounts[0], value: 2e18}, function(err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			function(done) {
				registrar.sealedBids(accounts[0], bid, function(err, deedAddress) {
					assert.equal(err, null, err);
					web3.eth.getBalance(deedAddress, function(err, balance) {
						assert.equal(err, null, err);
						assert.equal(balance.toNumber(), 2e18);
						done();
					})
				});
			}
		], done);
	});

	it('concludes auctions', function(done) {
		this.timeout(5000);
		var bidData = [
			// A regular bid
			{description: 'A regular bid', account: accounts[0], value: 1.1e18, deposit: 2.0e18, salt: 1, expectedFee: 0.005 },
			// A better bid
			{description: 'Winning bid', account: accounts[1], value: 2.0e18, deposit: 2.0e18, salt: 2, expectedFee: 0.75 },
			// Lower, but affects second place
			{description: 'Losing bid that affects price', account: accounts[2], value: 1.5e18, deposit: 2.0e18, salt: 3, expectedFee: 0.005 },
			// No effect
			{description: 'Losing bid that doesn\'t affect price', account: accounts[3], value: 1.2e18, deposit: 2.0e18, salt: 4, expectedFee: 0.005 },
			// Deposit smaller than value
			{description: 'Bid with deposit less than claimed value', account: accounts[4], value: 5.0e18, deposit: 1.0e17, salt: 5, expectedFee: 0.005 },
			// Invalid - doesn't reveal
			{description: 'Bid that wasn\'t revealed in time', account: accounts[5], value: 1.4e18, deposit: 2.0e18, salt: 6, expectedFee: 0.995 }
		];
		async.series([
			// Save initial balances 
			function(done) {
				async.each(bidData, function(bid, done) {
					web3.eth.getBalance(bid.account, function(err, balance){
						bid.startingBalance = balance.toFixed();
						done();
					});
				}, done);
			},
			// Start an auction for 'name'
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, done);
			},
			// Place each of the bids
			function(done) {
				async.each(bidData, function(bid, done) {
					registrar.shaBid(web3.sha3('name'), bid.account, bid.value, bid.salt, function(err, result) {
						bid.sealedBid = result;
						assert.equal(err, null, err);
						registrar.newBid(bid.sealedBid, {from: bid.account, value: bid.deposit}, function(err, txid) {
							assert.equal(err, null, err);
							done();
						});
					});
				}, done);
			},
			// Advance 26 days to the reveal period
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [26 * 24 * 60 * 60 + 1]}, done);
			},
			// Reveal all the bids
			function(done) {
				async.each(bidData, function(bid, done) {
					if (bid.salt !== 6) {
						registrar.unsealBid(web3.sha3('name'), bid.account, bid.value, bid.salt, {from: bid.account}, function(err, txid) {
							assert.equal(err, null, err);
							done();
						});
					} else {
						done();
					}
				}, done);
			},
			// Advance another two days to the end of the auction
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [48 * 60 * 60]}, done);
			},
			// Reveal last bid
			function(done) {
				bid = bidData[5];
				registrar.unsealBid(web3.sha3('name'), bid.account, bid.value, bid.salt, {from: bid.account}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
			},
			// Finalize the auction
			function(done) {
				registrar.finalizeAuction(web3.sha3('name'), {from: accounts[1]}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
			},
			// Check the name has the correct owner, value, and highestBid
			function(done) {
				registrar.entries(web3.sha3('name'), function(err, result) {
					assert.equal(err, null, err);
					assert.equal(result[0], 2); // status == Owned
					assert.equal(result[3], 1.5e18); // value = 1.5 ether
					assert.equal(result[4], 2e18); // highestBid = 2 ether
					async.series([
						// Check the owner is correct
						function(done) {
							var deed = web3.eth.contract(deedABI).at(result[1]);
							deed.owner(function(err, addr) {
								assert.equal(err, null, err);
								assert.equal(addr, accounts[1]);
								done();
							});
						},
						// Check the balance is correct
						function(done) {
							web3.eth.getBalance(result[1], function(err, balance) {
								assert.equal(err, null, err);
								assert.equal(balance.toNumber(), bidData[2].value);
								done();
							});
						}
					], done);
				});
			},
			// Check balances
			function(done) {
				async.each(bidData, function(bid, done) {
					web3.eth.getBalance(bid.account, function(err, balance){
						var spentFee = Math.floor(10000*(bid.startingBalance - balance.toFixed()) / Math.min(bid.value, bid.deposit))/10000;
						console.log('\t Bidder #' + bid.salt, bid.description + '. Spent:', 100*spentFee + '%; Expected:', 100*bid.expectedFee + '%;');
						assert.equal(spentFee, bid.expectedFee);
						done();
					});
				}, done);
			},
			// Check the owner is set in ENS
			function(done) {
				ens.owner(nameDotEth, function(err, owner) {
					assert.equal(err, null, err);
					assert.equal(owner, accounts[1]);
					done();
				});
			}
		], done);
	});
	
	it('cancels bids', function(done) {
		this.timeout(5000);
		var bidData = [
			// A regular bid
			{description: 'A regular bid 1', account: accounts[0], value: 1.5e18, deposit: 2.0e18, salt: 1, expectedFee: 0.005 },
			{description: 'A regular bid 2', account: accounts[1], value: 1.1e18, deposit: 2.0e18, salt: 1, expectedFee: 0.005 },
			{description: 'A regular bid 3', account: accounts[2], value: 1.1e18, deposit: 2.0e18, salt: 1, expectedFee: 0.005 },
		];
		async.series([
			// Start an auction for 'cancelname'
			function(done) {
				registrar.startAuction(web3.sha3('cancelname'), {from: accounts[0]}, done);
			},
			// Place each of the bids
			function(done) {
				async.each(bidData, function(bid, done) {
					registrar.shaBid(web3.sha3('cancelname'), bid.account, bid.value, bid.salt, function(err, result) {
						bid.sealedBid = result;
						assert.equal(err, null, err);
						registrar.newBid(bid.sealedBid, {from: bid.account, value: bid.deposit}, function(err, txid) {
							assert.equal(err, null, err);
							done();
						});
					});
				}, done);
			},
			// Attempt to cancel the first bid and fail
			function(done) {
				let bid = bidData[0];
				registrar.shaBid(web3.sha3('cancelname'), bid.account, bid.value, bid.salt, function(err, result) {
					bid.sealedBid = result;
					registrar.cancelBid(bid.account, bid.sealedBid, {from: bid.account}, function(err, txid) {
						assert.notEqual(err, null, err);
						registrar.sealedBids(bid.account, bid.sealedBid, function(err, result) {
							assert.equal(err, null, err);
							assert.notEqual(result, 0);
							console.log('\t Bid #1 not cancelled');
							done();
						});
					});
				});
			},
			// Advance 26 days to the reveal period
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [26 * 24 * 60 * 60 + 1]}, done);
			},
			
			// Attempt to cancel the second bid and fail
			function(done) {
				let bid = bidData[1];
				registrar.shaBid(web3.sha3('cancelname'), bid.account, bid.value, bid.salt, function(err, result) {
					bid.sealedBid = result;
					registrar.cancelBid(bid.account, bid.sealedBid, {from: bid.account}, function(err, txid) {
						assert.notEqual(err, null, err);
						registrar.sealedBids(bid.account, bid.sealedBid, function(err, result) {
							assert.equal(err, null, err);
							assert.notEqual(result, 0);
							console.log('\t Bid #2 not cancelled pre-reveal');
							done();
						});
					});
				});
			},	
			// Reveal the second bid
			function(done) {
				let bid = bidData[1];
				registrar.unsealBid(web3.sha3('cancelname'), bid.account, bid.value, bid.salt, {from: bid.account}, function(err, txid) {
					assert.equal(err, null, err);
					console.log('\t Bid #2 revealed');
					done();
				});
			},
			// Attempt to cancel the second bid and fail
			function(done) {
				let bid = bidData[1];
				registrar.shaBid(web3.sha3('cancelname'), bid.account, bid.value, bid.salt, function(err, result) {
					bid.sealedBid = result;
					registrar.cancelBid(bid.account, bid.sealedBid, {from: bid.account}, function(err, txid) {
						assert.notEqual(err, null, err);
						registrar.sealedBids(bid.account, bid.sealedBid, function(err, result) {
							assert.equal(err, null, err);
							assert.equal(result, 0);
							console.log('\t Bid #2 not cancelled post-reveal. Sealedbid removed');
							done();
						});
					});
				});
			},	
			// Advance another two days to the end of the auction
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [48 * 60 * 60]}, done);
			},
			// Finalize the auction and get the deed address
			function(done) {
				registrar.finalizeAuction(web3.sha3('cancelname'), {from: accounts[1]}, function(err, txid) {
					assert.equal(err, null, err);
					registrar.entries(web3.sha3('cancelname'), function(err, result) {
						console.log('\t Auction finalized');
						assert.equal(err, null, err);
						done();
					});
				});
			},
			// Attempt to cancel the third bid and fail
			function(done) {
				let bid = bidData[2];
				registrar.shaBid(web3.sha3('cancelname'), bid.account, bid.value, bid.salt, function(err, result) {
					bid.sealedBid = result;
					registrar.cancelBid(bid.account, bid.sealedBid, {from: bid.account}, function(err, txid) {
						assert.equal(err, null, err);
						console.log('\t Bid #3 not cancelled post-finalize');
						done();
					});
				});
			},
			// Advance another four weeks
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [4 * 7 * 24 * 60 * 60]}, done);
			},

			// Cancel the third bid
			function(done) {
				let bid = bidData[2];
				registrar.shaBid(web3.sha3('cancelname'), bid.account, bid.value, bid.salt, function(err, result) {
					bid.sealedBid = result;
					registrar.cancelBid(bid.account, bid.sealedBid, {from: bid.account}, function(err, txid) {
						assert.notEqual(err, null, err);
						console.log('\t Bid #3 cancelled');
						done();
					});
				});
			},
			// Attempt to cancel again and fail
			function(done) {
				let bid = bidData[2];
				registrar.shaBid(web3.sha3('cancelname'), bid.account, bid.value, bid.salt, function(err, result) {
					bid.sealedBid = result;
					registrar.cancelBid(bid.account, bid.sealedBid, {from: bid.account}, function(err, txid) {
						assert.notEqual(err, null, err);
						console.log('\t Bid #3 could not cancel a second time');
						done();
					});
				});
			}
		], done);
	});

	it('releases deed after one year', function(done) {
		this.timeout(5000);
		var bid = {description: 'A regular bid', account: accounts[0], value: 1.1e18, deposit: 2.0e18, salt: 1, expectedFee: 0.005 };
		async.series([
			// Start an auction for 'releasename'
			function(done) {
				registrar.startAuction(web3.sha3('releasename'), {from: bid.account}, done);
			},
			// Place the bid
			function(done) {
				registrar.shaBid(web3.sha3('releasename'), bid.account, bid.value, bid.salt, function(err, result) {
					bid.sealedBid = result;
					assert.equal(err, null, err);
					registrar.newBid(bid.sealedBid, {from: bid.account, value: bid.deposit}, function(err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			// Advance 26 days to the reveal period
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [26 * 24 * 60 * 60 + 1]}, done);
			},
			// Reveal the bid
			function(done) {
				registrar.unsealBid(web3.sha3('releasename'), bid.account, bid.value, bid.salt, {from: bid.account}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
			},
			// Advance another two days to the end of the auction
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [48 * 60 * 60]}, done);
			},
			// Finalize the auction
			function(done) {
				registrar.finalizeAuction(web3.sha3('releasename'), {from: bid.account}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
			},
			// Save balance
			function(done) {
				web3.eth.getBalance(bid.account, function(err, balance){
					bid.startingBalance = balance.toFixed();
					done();
				});
			},
			// Attempt to release the deed early
			function(done) {
				registrar.releaseDeed(web3.sha3('releasename'), {from: bid.account}, function(err, txid) {
					assert.notEqual(err, null, err);
					console.log("\t Could not release early");
					done();
				});
			},
			// Advance one year
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [365 * 24 * 60 * 60]}, done);
			},
			// Release the deed
			function(done) {
				registrar.releaseDeed(web3.sha3('releasename'), {from: bid.account}, function(err, txid) {
					assert.equal(err, null, err);
					console.log("\t Deed released");
					web3.eth.getBalance(bid.account, function(err, balance){
						assert.ok(balance.toFixed() > bid.startingBalance);
						console.log("\t Balance before: "+bid.startingBalance+" after: "+balance.toFixed());
						done();
					});
				});
			},
			// Attempt to release the deed twice
			function(done) {
				registrar.releaseDeed(web3.sha3('releasename'), {from: bid.account}, function(err, txid) {
					assert.notEqual(err, null, err);
					console.log("\t Could not release deed twice");
					done();
				});
			},
			// Check the name has the correct state and owner
			function(done) {
				registrar.entries(web3.sha3('releasename'), function(err, result) {
					assert.equal(err, null, err);
					assert.equal(result[0], 0); // status == Open
					console.log("\t Name is Open");
					done();
				});
			},
		], done);
	});

	it('calling startAuction on a finished auction has no effect', function(done) {
		var auctionStatus = null;
		async.series([
			// Start an auction for 'name'
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, done);
			},
			// Place a bid on it
			function(done) {
				registrar.shaBid(web3.sha3('name'), accounts[0], 1e18, 1, function(err, result) {
					assert.equal(err, null, err);
					registrar.newBid(result, {from: accounts[0], value: 1e18}, function(Err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			// Advance 26 days to the reveal period
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [26 * 24 * 60 * 60 + 1]}, done);
			},
			// Reveal the bid
			function(done) {
				registrar.unsealBid(web3.sha3('name'), accounts[0], 1e18, 1, {from: accounts[0]}, function(err, txid) {
					assert.equal(err, null, err);
					registrar.entries(web3.sha3('name'), function(err, result) {
						assert.equal(err, null, err);
						auctionStatus = result;
						done();
					});
				});
			},
			// Advance another two days to the end of the auction
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [48 * 60 * 60]}, done);
			},
			// Have someone else call startAuction
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, function(err, result) {
					assert.ok(err.toString().indexOf(utils.INVALID_JUMP) != -1, err);
					done();
				});
			},
			// Check that the deed is still set correctly
			function(done) {
				registrar.entries(web3.sha3('name'), function(err, result) {
					assert.equal(err, null, err);
					assert.deepEqual(auctionStatus.slice(1), result.slice(1));
					done();
				});
			}
		], done);
	});

	it('takes the max of declared and provided value', function(done) {
		async.series([
			// Start an auction for 'name'
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, done);
			},
			// Place some bids
			function(done) {
				registrar.shaBid(web3.sha3('name'), accounts[0], 2e18, 1, function(err, result) {
					assert.equal(err, null, err);
					registrar.newBid(result, {from: accounts[0], value: 1e18}, function(Err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			function(done) {
				registrar.shaBid(web3.sha3('name'), accounts[1], 4e18, 1, function(err, result) {
					assert.equal(err, null, err);
					registrar.newBid(result, {from: accounts[1], value: 3e18}, function(Err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			// Advance 26 days to the reveal period
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [26 * 24 * 60 * 60 + 1]}, done);
			},
			// Reveal the bids and check they're processed correctly.
			function(done) {
				registrar.unsealBid(web3.sha3('name'), accounts[0], 2e18, 1, {from: accounts[0]}, function(err, txid) {
					assert.equal(err, null, err);
					registrar.entries(web3.sha3('name'), function(err, result) {
						assert.equal(err, null, err);
						assert.equal(result[3], 0);
						assert.equal(result[4], 1e18);
						auctionStatus = result;
						done();
					});
				});
			},
			function(done) {
				registrar.unsealBid(web3.sha3('name'), accounts[1], 4e18, 1, {from: accounts[1]}, function(err, txid) {
					assert.equal(err, null, err);
					registrar.entries(web3.sha3('name'), function(err, result) {
						assert.equal(err, null, err);
						assert.equal(result[3], 1e18);
						assert.equal(result[4], 3e18);
						auctionStatus = result;
						done();
					});
				});
			}
		], done);
	});

	it('invalidate short names', function(done) {
		let bid = {account: accounts[0], value: 1.5e18, deposit: 2e18, salt: 1, description: 'bidded before invalidation' };
		let invalidator = {account: accounts[2]};
		async.series([
			// Save initial balances 
			function(done) {
				web3.eth.getBalance(bid.account, function(err, balance){
					bid.startingBalance = balance.toFixed();
					done();
				});
			},
			// Save initial invalidator balances 
			function(done) {
				web3.eth.getBalance(invalidator.account, function(err, balance){
					invalidator.startingBalance = balance.toFixed();
					done();
				});
			},			
			function(done) {
				// Test multiple auctions
				registrar.startAuctions([web3.sha3('name'), web3.sha3('longname'), web3.sha3('thirdname')], {from: accounts[0]}, done);
			},
			function(done) {
				registrar.entries(web3.sha3('name'), function(err, result) {
					// Test if foo is an auction
					assert.equal(result[0], 1); // status == Auction
					done();
				});
			},			
			function(done) {
				registrar.entries(web3.sha3('longname'), function(err, result) {
					// Tests if foobars is an auction
					assert.equal(result[0], 1); // status == Auction
					done();
				});
			},
			// Place each of the bids
			function(done) {
				registrar.shaBid(web3.sha3('name'), bid.account, bid.value, bid.salt, function(err, result) {
					bid.sealedBid = result;
					assert.equal(err, null, err);
					registrar.newBid(bid.sealedBid, {from: bid.account, value: bid.deposit}, function(err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			// Advance 26 days to the reveal period
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [26 * 24 * 60 * 60 + 1]}, done);
			},
			// Reveal the bid
			function(done) {
				registrar.unsealBid(web3.sha3('name'), bid.account, bid.value, bid.salt, {from: bid.account}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
			},
			// Advance to the end of the auction
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [48 * 60 * 60 + 1]}, done);
			},
			// Invalidate Name
			function(done) {
				registrar.invalidateName('name', {from: invalidator.account}, function(err, txid) {
					assert.equal(err, null);
					done();
				});		
			},
			function(done) {
				registrar.entries(web3.sha3('name'), function(err, result) {
					// Test if 'foo' is now 'forbidden'
					assert.equal(result[0], 3); // status == Forbidden	
					done();
				});
			},
			// Check balances
			function(done) {
				web3.eth.getBalance(bid.account, function(err, balance){
					var spentFee = Math.floor(web3.fromWei(bid.startingBalance - balance.toFixed(), 'finney'));
					console.log('\t Bidder #'+ bid.salt, bid.description, 'spent:', spentFee, 'finney;');
					assert.equal(spentFee, 750);
					done();
				});
			},
			// Get current invalidator balances 
			function(done) {
				web3.eth.getBalance(invalidator.account, function(err, balance){
					let fee = Math.floor(web3.fromWei(balance.toFixed() - invalidator.startingBalance, 'finney'));
					console.log('\t Invalidator got: ', fee, 'finney');
					assert.equal(fee, 749);
					done();
				});
			},
			function(done) {
				// Makes sure it can't be registered again
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, function(err, res){
					assert.notEqual(err, null);
					done();
				});
			}
		], done);
	});

	it('supports transferring deeds to another registrar', function(done) {
		var bidData = [
			{account: accounts[0], value: 1e18, deposit: 2e18, salt: 1},
		];
		var deedAddress = null;
		async.series([
			// Start an auction for 'name'
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, done);
			},
			// Place each of the bids
			function(done) {
				registrar.shaBid(web3.sha3('name'), accounts[0], 1e18, 1, function(err, result) {
					var sealedBid = result;
					assert.equal(err, null, err);
					registrar.newBid(sealedBid, {from: accounts[0], value: 2e18}, function(err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			// Advance 26 days to the reveal period
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [26 * 24 * 60 * 60 + 1]}, done);
			},
			// Reveal the bid
			function(done) {
				registrar.unsealBid(web3.sha3('name'), accounts[0], 1e18, 1, {from: accounts[0]}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
			},
			// Advance another two days to the end of the auction
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [48 * 60 * 60]}, done);
			},
			// Finalize the auction and get the deed address
			function(done) {
				registrar.finalizeAuction(web3.sha3('name'), {from: accounts[0]}, function(err, txid) {
					assert.equal(err, null, err);
					registrar.entries(web3.sha3('name'), function(err, result) {
						assert.equal(err, null, err);
						deedAddress = result[1];
						done();
					});
				});
			},
			// Update ENS with a new registrar
			function(done) {
				ens.setSubnodeOwner(0, web3.sha3('eth'), accounts[2], {from: accounts[0]}, done);
			},
			// Transfer the deed
			function(done) {
				registrar.transferRegistrars(web3.sha3('name'), {from: accounts[0]}, done);
			},
			// Check the deed was transferred as expected
			function(done) {
				web3.eth.contract(deedABI).at(deedAddress).registrar(function(err, owner) {
					assert.equal(err, null, err);
					assert.equal(accounts[2], owner);
					done();
				});
			}
		], done);		
	});

	it('supports transferring domains to another account', function(done) {
		var bidData = [
			{account: accounts[0], value: 1e18, deposit: 2e18, salt: 1},
		];
		var deedAddress = null;
		async.series([
			// Start an auction for 'name'
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, done);
			},
			// Place each of the bids
			function(done) {
				registrar.shaBid(web3.sha3('name'), accounts[0], 1e18, 1, function(err, result) {
					var sealedBid = result;
					assert.equal(err, null, err);
					registrar.newBid(sealedBid, {from: accounts[0], value: 2e18}, function(err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			// Advance 26 days to the reveal period
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [26 * 24 * 60 * 60 + 1]}, done);
			},
			// Reveal the bid
			function(done) {
				registrar.unsealBid(web3.sha3('name'), accounts[0], 1e18, 1, {from: accounts[0]}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
			},
			// Advance another two days to the end of the auction
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [48 * 60 * 60]}, done);
			},
			// Finalize the auction and get the deed address
			function(done) {
				registrar.finalizeAuction(web3.sha3('name'), {from: accounts[0]}, function(err, txid) {
					assert.equal(err, null, err);
					registrar.entries(web3.sha3('name'), function(err, result) {
						assert.equal(err, null, err);
						deedAddress = result[1];
						done();
					});
				});
			},
			// Transfer ownership to another account
			function(done) {
				registrar.transfer(web3.sha3('name'), accounts[1], {from: accounts[0]}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
			},
			// Check the new owner was set on the deed
			function(done) {
				web3.eth.contract(deedABI).at(deedAddress).owner(function(err, owner) {
					assert.equal(err, null, err);
					assert.equal(accounts[1], owner);
					done();
				});
			}
		], done);
	});

	it('prohibits late funding of bids', function(done) {
		let bid = {account: accounts[0], value: 1.3e18, deposit: 1.0e17, salt: 1, description: 'underfunded bid' };
		let bidWinner = {account: accounts[1], value: 1.2e18, deposit: 1.6e18, salt: 1, description: 'normally funded bid' };
		let deedAddress = null;

		async.series([
			// Save initial balances 
			function(done) {
				web3.eth.getBalance(bid.account, function(err, balance){
					bid.startingBalance = balance.toFixed();
					done();
				});
			},
			function(done) {
				// Start auction
				registrar.startAuction(web3.sha3('longname'), {from: accounts[0]}, done);
			},
			// Place the underfunded bid
			function(done) {
				registrar.shaBid(web3.sha3('longname'), bid.account, bid.value, bid.salt, function(err, result) {
					bid.sealedBid = result;
					assert.equal(err, null, err);
					registrar.newBid(bid.sealedBid, {from: bid.account, value: bid.deposit}, function(err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			// Place the normal bid
			function(done) {
				registrar.shaBid(web3.sha3('longname'), bidWinner.account, bidWinner.value, bidWinner.salt, function(err, result) {
					bidWinner.sealedBid = result;
					assert.equal(err, null, err);
					registrar.newBid(bidWinner.sealedBid, {from: bidWinner.account, value: bidWinner.deposit}, function(err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			// Advance 26 days to the reveal period
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [26 * 24 * 60 * 60 + 1]}, done);
			},
			// Reveal the normal bid
			function(done) {
				registrar.unsealBid(web3.sha3('longname'), bidWinner.account, bidWinner.value, bidWinner.salt, {from: bidWinner.account}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
				
			},			
			// Sneakily top up the bid
			function(done) {
				registrar.sealedBids(bid.account, bid.sealedBid, function(err, result) {
					assert.equal(err, null, err);
					web3.eth.sendTransaction({from: accounts[0], to: result, value: 2e18}, function(err, txid) {
						web3.eth.getBalance(result, function(err, balance) {
							console.log("\t Balance: " + balance);
							done();
						});
					});
				});
				// done();
			},
			// Reveal the underfunded bid
			function(done) {
				registrar.unsealBid(web3.sha3('longname'), bid.account, bid.value, bid.salt, {from: bid.account}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
				
			},
			// Check balance
			function(done) {
				web3.eth.getBalance(bid.account, function(err, balance){
					var spentFee = Math.floor(web3.fromWei(bid.startingBalance - balance.toFixed(), 'finney'));
					console.log('\t Bidder #'+ bid.salt, bid.description, 'spent:', spentFee, 'finney;');
					assert.equal(spentFee, 100);
					// It sends 100 finney, and the bid is considered invalid and therefore is spent
					done();
				});
			},
			// Finalize the auction and get the deed address
			function(done) {
				registrar.finalizeAuction(web3.sha3('longname'), {from: bid.account}, function(err, txid) {
					assert.equal(err, null, err);
					registrar.entries(web3.sha3('longname'), function(err, result) {
						assert.equal(err, null, err);
						deedAddress = result[1];
						done();
					});
				});
			},
			// Check the new owner was set on the deed
			function(done) {
				
				web3.eth.contract(deedABI).at(deedAddress).owner(function(err, owner) {
					console.log('\t',bid.account == owner? "underfunded bid wins" : "underfunded bid loses");
					assert.equal(err, null, err);
					assert.equal(accounts[1], owner);
					done();
				});
			}
		], done);
	});

	it('prohibits bids during the reveal period', function(done) {
		let bid = {account: accounts[0], value: 1.5e18, deposit: 1e17, salt: 1, description: 'underfunded bid' };
		async.series([
			// Save initial balances 
			function(done) {
				web3.eth.getBalance(bid.account, function(err, balance){
					bid.startingBalance = balance.toFixed();
					done();
				});
			},
			function(done) {
				// Start auction
				registrar.startAuction(web3.sha3('longname'), {from: accounts[0]}, done);
			},
			// Advance 26 days to the reveal period
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [26 * 24 * 60 * 60 + 1]}, done);
			},
			// Place the bid
			function(done) {
				registrar.shaBid(web3.sha3('longname'), bid.account, bid.value, bid.salt, function(err, result) {
					bid.sealedBid = result;
					assert.equal(err, null, err);
					registrar.newBid(bid.sealedBid, {from: bid.account, value: bid.deposit}, function(err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			// Reveal the bid
			function(done) {
				registrar.unsealBid(web3.sha3('longname'), bid.account, bid.value, bid.salt, {from: bid.account}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
			},
			function(done) {
				registrar.entries(web3.sha3('longname'), function(err, result) {
					assert.equal(err, null, err);
					assert.equal(result[1], "0x0000000000000000000000000000000000000000");
					done();
				});
			},
		], done);		
	});

	it('allows returning deeds from previous registrars', function(done) {
		var bid = {account: accounts[0], value: 1e18, deposit: 2e18, salt: 1};
		var deedAddress = null;
		var newRegistrar = null;
		async.series([
			// Save initial balances 
			function(done) {
				web3.eth.getBalance(bid.account, function(err, balance){
					bid.startingBalance = balance.toFixed();
					done();
				});
			},
			// Start an auction for 'name'
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, done);
			},
			// Place each of the bids
			function(done) {
				registrar.shaBid(web3.sha3('name'), accounts[0], bid.value, 1, function(err, result) {
					var sealedBid = result;
					assert.equal(err, null, err);
					registrar.newBid(sealedBid, {from: accounts[0], value: bid.deposit}, function(err, txid) {
						assert.equal(err, null, err);
						done();
					});
				});
			},
			// Deploy a new registrar
			function(done) {
				newRegistrar = web3.eth.contract(registrarABI).new(
				    ens.address,
				    dotEth,
				    0,
				    {
				    	from: accounts[0],
				     	data: registrarBytecode,
				     	gas: 4700000
				   	}, function(err, contract) {
				   	    assert.equal(err, null, err);
				   	    if(contract.address != undefined) {
				   	    	done();
					   	}
				   });
			},
			function(done) { ens.setSubnodeOwner(0, web3.sha3('eth'), newRegistrar.address, {from: accounts[0]}, done);},
			// Advance 26 days to the reveal period
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [26 * 24 * 60 * 60 + 1]}, done);
			},
			// Reveal the bid
			function(done) {
				registrar.unsealBid(web3.sha3('name'), accounts[0], bid.value, 1, {from: accounts[0]}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
			},
			// Advance another two days to the end of the auction
			function(done) { web3.currentProvider.sendAsync({
				jsonrpc: "2.0",
				"method": "evm_increaseTime",
				params: [48 * 60 * 60]}, done);
			},
			// Get the deed address
			function(done) {
				registrar.entries(web3.sha3('name'), function(err, result) {
					assert.equal(err, null, err);
					deedAddress = result[1];
					done();
				});
			},
			// Transfer the deed
			function(done) {
				registrar.transferRegistrars(web3.sha3('name'), {from: accounts[0]}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
			},
			// Return the deed
			function(done) {
				newRegistrar.returnDeed(deedAddress, {from: accounts[0]}, function(err, txid) {
					assert.equal(err, null, err);
					done();
				});
			},
			// Check balance
			function(done) {
				web3.eth.getBalance(bid.account, function(err, balance){
					var spentFee = Math.floor(web3.fromWei(bid.startingBalance - balance.toFixed(), 'finney'));
					console.log('\t Bidder #'+ bid.salt, bid.description, 'spent:', spentFee, 'finney;');
					assert.equal(spentFee, 0);
					done();
				});
			}
		], done);
	})

	it("prohibits starting auctions when it's not the registrar", function(done) {
		var bid = {account: accounts[0], value: 1e18, deposit: 2e18, salt: 1};
		var deedAddress = null;
		var newRegistrar = null;
		async.series([
			// Start an auction for 'name'
			function(done) { ens.setSubnodeOwner(0, web3.sha3('eth'), accounts[0], {from: accounts[0]}, done);},
			function(done) {
				registrar.startAuction(web3.sha3('name'), {from: accounts[0]}, function(err, txid) {
					assert.ok(err.toString().indexOf(utils.INVALID_JUMP) != -1, err);
					done();
				});
			},
		], done);
	});
});
