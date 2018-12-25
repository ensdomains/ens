const Promise = require('bluebird');

function isException(error) {
    let strError = error.toString();
    return strError.includes('invalid opcode') || strError.includes('invalid JUMP') || strError.includes('revert');
}

function ensureException(error) {
    assert(isException(error), error.toString());
}

const advanceTime = Promise.promisify(function(delay, done) {
	web3.currentProvider.send({
		jsonrpc: "2.0",
		"method": "evm_increaseTime",
		params: [delay]}, done)
});

module.exports = {
    zeroAddress: '0x0000000000000000000000000000000000000000',
    ensureException: ensureException,
    advanceTime: advanceTime
};
