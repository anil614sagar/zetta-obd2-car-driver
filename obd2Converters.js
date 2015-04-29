var exports = module.exports = {};

exports.getEngineLoadValue = function (byte) {
    return parseInt(byte, 16) * (100 / 255);
}

exports.getEngineCoolantTempValue = function (byte) {
    return parseInt(byte, 16) - 40;
}

exports.getEngineRPM = function (byteA, byteB) {
    return ((parseInt(byteA, 16) * 256) + parseInt(byteB, 16)) / 4;
}

exports.getSpeed = function (byte) {
    return parseInt(byte, 16);
}
