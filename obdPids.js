var obd2Converter = require("./obd2Converters.js");

var responsePIDS;
var currentData = "01";

responsePIDS = [
    // Realtime Current data
    { mode: currentData, pid: "04", bytesReturned: 1, name: "engineLoad",
      description: "Calculate Engine LOAD Value", min: 0, max: 100, unit: "%",
      convertToReadable: obd2Converter.getEngineLoadValue
    },
    { mode: currentData, pid: "05", bytesReturned: 1, name: "coolantTemp",
      description: "Engine Coolant Temperature", min: -40, max: 215, unit: "Celsius",
      convertToReadable: obd2Converter.getEngineCoolantTempValue
    },
    { mode: currentData, pid: "0C", bytesReturned: 2, name: "engineRPM",
      description: "Engine RPM", min: 0, max: 16383.75, unit: "rev/min",
      convertToReadable: obd2Converter.getEngineRPM
    },
    { mode: currentData, pid: "0D", bytesReturned: 1, name: "speed",
      description: "Vehicle Speed", min: 0, max: 255, unit: "km/h",
      convertToReadable: obd2Converter.getSpeed
    },
];

var exports = module.exports = responsePIDS;
