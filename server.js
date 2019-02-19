var mqtt=require('mqtt');
const args = require('minimist')(process.argv.slice(2));
var nodeCleanup = require('node-cleanup');
const fs = require('fs');

/*
 * -i wait_time_in_msec
 * -h hostname (if ommited localhost is used)
 * -p port (if ommited port 1883 is used)
 * -b number_of_bytes_send (10 if ommitted)
 * -q qos_option (0 if ommitted)
 * -u user
 * -s passwd
 * -l location file where gps location is stored
 * -c cellid file where cellid is stored
 * -o output logfile name to write to
 */






 // when running on the cluster with rabbitmq use "rabbitmq.default.svc.appfactory.local"
 // for the hostname

var mqtt_hostname = (typeof args.h === 'undefined' || args.h === null) ? "localhost" : args.h;

var mqtt_options = {
    clientId: "mqttjs01",
    username: (typeof args.u === 'undefined' || args.u === null) ? "testuser" : args.u,
    password: (typeof args.s === 'undefined' || args.s === null) ? "passwd" : args.s,
    port: (typeof args.p === 'undefined' || args.p === null) ? 1883 : args.p,
    clean:false};

var message_options = {
    retain:false,
    qos:(typeof args.q === 'undefined' || args.q === null) ? 0 : args.q
};

var file_location = (typeof args.l === 'undefined' || args.l === null) ? "location.value" : args.l;
var file_cellid = (typeof args.c === 'undefined' || args.c === null) ? "cellid.value" : args.c;
var file_log = (typeof args.o === 'undefined' || args.o === null) ? null : args.o;

var topic="testtimingtopic";
var number_of_bytes_send = (typeof args.b === 'undefined' || args.b === null) ? 10 : args.b;
const message_buffer = Buffer.alloc(number_of_bytes_send, 1); // buffer filled with ones
var sendtime = 999; // arbitrary number other than 0 to start only with sending after subscribing
var connected = false;
var interval = (typeof args.i === 'undefined' || args.i === null) ? 500 : args.i; // millisecond
var timing_values = [];
var client  = mqtt.connect('mqtt://'+mqtt_hostname,
                           mqtt_options
                           );

// setup file read for position and cellid
var fd_location = null;
var fd_cellid = null;
var fd_log = null;
var buffer_location = Buffer.alloc(50);
var buffer_cellid = Buffer.alloc(10);

// open location file
fs.stat(file_location, function postStat(errStat, stats) {
    if (errStat) {
        console.error("could not locate file: " + file_location);
        process.exit(1);
    }
    fs.open(file_location, 'r', function postOpen(errOpen, fd) {
        if (errOpen) {
            console.error("could not open file: " + file_location);
            process.exit(1);
        }
        fd_location = fd;
        fs.read(fd_location, buffer_location, 0, 50, 0, function postRead(errRead, bytesRead, buffer) {
            if (errRead) {
                console.error("could not read file: " + file_location);
                process.exit(1);
            }
            console.log("found location with value: " + buffer.toString('utf8').slice(0,-50+bytesRead).trim());
        });
    });
  });

// open cellid file
fs.stat(file_cellid, function postStat(errStat, stats) {
    if (errStat) {
        console.error("could not locate file: " + file_cellid);
        process.exit(1);
    }
    fs.open(file_cellid, 'r', function postOpen(errOpen, fd) {
        if (errOpen) {
            console.error("could not open file: " + file_cellid);
            process.exit(1);
        }
        fd_cellid = fd;
        fs.read(fd_cellid, buffer_cellid, 0, 10, 0, function postRead(errRead, bytesRead, buffer) {
            if (errRead) {
                console.error("could not read file: " + file_cellid);
                process.exit(1);
            }
            console.log("found cellid with value: " + buffer.toString('utf8').slice(0,-10+bytesRead).trim());
        });
    });
  });

// open log file
if (file_log) {
    fs.open(file_log, 'a', function postOpen(errOpen, fd) {
        if (errOpen) {
            console.error("could not open file: " + file_log + " for writing");
            process.exit(1);
        }
        fd_log = fd;
    });
} else {
    // set to stdout
    fd_log = 1;
}


client.on("connect",function(){	
    connected = client.connected;
    client.subscribe(topic, function (err) {
        if (!err) {
          console.log("subscribed to topic " + topic);
          sendtime = 0; // enable sending
        } else console.log( "error subscribing:" + err );
    });
});

client.on("error", function(error){ 
   console.log("Can't connect"+error);
   process.exit(1);
});

//handle incoming messages
client.on('message',function(topic, message, packet){
    // console.log("incomming message with sendtime: " + sendtime + " and message: " + message);
    if (sendtime != 0 && fd_location && fd_cellid) {
        fs.read(fd_location, buffer_location, 0, 50, 0, function postRead(errRead, bytesRead_loc, buffer_loc) {
            if (errRead) {
                console.error("could not read file: " + file_location);
                process.exit(1);
            }
            fs.read(fd_cellid, buffer_cellid, 0, 10, 0, function postRead(errRead, bytesRead_cellid, buffer_cellid) {
                if (errRead) {
                    console.error("could not read file: " + file_cellid);
                    process.exit(1);
                }
                fs.write(fd_log, process.hrtime(sendtime)[1]/1000000 + "|" + buffer_loc.toString('utf8').slice(0, -50 + bytesRead_loc).trimRight() + "|" + buffer_cellid.toString('utf8').slice(0, -10 + bytesRead_cellid).trimRight() + "\n",function postWrite(errWrite, written, string){
                    if (errWrite) {
                        console.error("Error writing log data");
                    }
                });
                timing_values.push(process.hrtime(sendtime)[1]);
                sendtime = 0;
            });

        });

    }
});

 
setInterval(function(){
    // console.log("interval called with connected: " + connected + " sendtime:" + sendtime);
    if ( connected == true && sendtime == 0) {
        sendtime = process.hrtime();
        client.publish(topic, message_buffer, message_options);
    } else {
        if (connected == false) {
            console.log("no connection...");
        } else {
            console.log("skipping...");
        }
    }
}, interval);

var average = function(elmt) {
    var sum = 0;
    for( var i = 0; i < elmt.length; i++ ){
        sum += parseInt( elmt[i], 10 ); //don't forget to add the base
    }

    var avg = sum/elmt.length;
    return avg;
}

nodeCleanup(function (exitCode, signal) {
    min_value = Math.min.apply(null, timing_values);
    max_value = Math.max.apply(null, timing_values);
    avg_value = average(timing_values);
    console.log("");
    console.log("min, avg, max (msec): " + min_value/1000000 + ", " + avg_value/1000000 + ", " + max_value/1000000);
    if (fd_cellid) {
        fs.closeSync(fd_cellid);
    }
    if (fd_location) {
        fs.closeSync(fd_location);
    }
    if (fd_log != null && fd_log != 1) {
        fs.closeSync(fd_log);
    }
});