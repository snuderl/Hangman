var http = require("http");
var static = require('node-static')
var file = new (static.Server)("static");
var fs = require("fs");
// Create the server. Function passed as parameter is called on every request made.
// request variable holds all request parameters
// response variable allows you to do anything with response sent to the client.
var server=http.createServer(function  (request, response) {
    console.log("1");
   request.addListener("end", function(){
        console.log("1");
      file.serve(request,response);
   });
// Listen on the 8080 port.
}).listen(process.env.PORT || 3000);

console.log("Serving on port:"+process.env.PORT);

var clients = {};
var games = {};
var besede = fs.readFileSync('besede.txt').toString().split("\r\n");

function newgame(gameID, creatorID, userName){
    var players = new Array();
    players.push(createPlayer(userName,creatorID,true));
    var game = {
        players : players,
        gameID : gameID,
        poteka: false,
        zacne: 0,
        next: function(){
            this.zacne+=1;
            if(this.zacne==this.players.length){
                this.zacne=0;
            }
        },
        updateRoundStatus: function(){
            for(var i = 0;i<this.players.length;i++){
                if(this.players[i].status=="Na potezi"){
                    this.players[i].status="";
                    if(i==this.players.length-1){
                        this.players[0].status="Na potezi";
                    }else{
                        this.players[i+1].status="Na potezi";
                    }
                    return;
                }
            }
        },
        sendAll: function(name,data){
            console.log("sendAll");
            for(var i = 0;i<this.players.length;i++){
                console.log(players[i]);
                var s = clients[players[i].id];
                if(s!=null){
                    s.emit(name,data);
                }
            }
        }
    };
    games[gameID]=game;
    return game;
};

function randomBeseda(){
    var min = 0;
    var max = besede.length;
    r = Math.floor(Math.random()*(max-min) +min);
    return besede[r];
}

function createPlayer(name, id,zacel){
    var player = {
      name: name,
      id: id,
      zmag: 0,
      vsehTock: 0,
      tock: 0,
       zacel: zacel,
       status: "Čaka"

    };
    return player;
}

var io = require("socket.io").listen(server);
//io.static.add('index.html', {file: 'static/index.html'});
// io.configure(function () {
//   io.set("transports", ["xhr-polling"]);
//   io.set("polling duration", 10);
// });
io.set('log level', 1);
io.sockets.on("connection",function (socket){

    var cleanUp = function(){
        if(igra!=null){
            delete games[igra.id];
            igra=null;
        }
    };

    var userId = GUID();
    var igra = null;
    clients[userId]=socket;

    socket.on("disconnect",function(){
        console.log("disconected");

        if(igra!=null){
            igra.sendAll("konec",{status: "Igralec je zapustil igro."});
            cleanUp();
        }
        delete clients[userId];
    });

    console.log("New user connected: "+userId);
    socket.emit("welcome",{user:userId});


    socket.on("new-game", function(data){
        console.log("vidim:"+userId);
        var id = GUID();
            igra = newgame(id,userId, data.name);
            socket.set("game",igra.gameID);
            console.log("User "+ userId+ " created game with id: "+id +".");
            socket.emit("game-created",igra);
    });

    socket.on("starting-game",function(data){

            var igralec = GetIgralecFromID(userId,igra.players);
            igralec.status="Pripravljen";
            if(igra.players.all(function(p){ return p.status=="Pripravljen"; })){

                igra.players.each(function(p){p.zacel=false;});
                igra.players[igra.zacne].zacel=true;
                igra.players.each(function(p){p.status=""});
                igra.players[igra.zacne].status = "Na potezi";

                igra.beseda = randomBeseda().toLowerCase();
                igra.poteka = true;
                igra.trenutnoUgotovljena = igra.beseda.replace(/[a-zA-ZčšžČŠŽ]/g,"_");
                igra.sendAll("players", {players:igra.players});
                igra.sendAll("game-started",{beseda:igra.trenutnoUgotovljena,zacne:igra.zacne});
            }
            else{
                igra.sendAll("players", {players:igra.players});
            }
    });

    socket.on("konec", function(data){
        for(var i=0;i<igra.players.length;i++){
            var igralec = igra.players[i];
            if(igralec.id!=userId){
                var s =clients[igralec.id];
                if(s!=null){
                    s.emit("konec",{status: "Eden od igralcev je odstopil. Igra je s tem prekinjena."});
                }
            }
        }
        cleanUp();
    });

    socket.on("vnos",function(data){
               var vnos = data.vnos.toLocaleLowerCase();
               var beseda = igra.beseda;
                var rundaKoncana = false;
               var status = "";
               if(vnos.length==1){
                    if( beseda.indexOf(vnos)!=-1){
                        var trenutnoUgotovljena = igra.trenutnoUgotovljena;
                        for(var i = 0;i<trenutnoUgotovljena.length;i++){
                            if(beseda.charAt(i)==vnos.charAt(0)){
                                    trenutnoUgotovljena = trenutnoUgotovljena.replaceAt(i,vnos);
                            }
                        }
                        igra.trenutnoUgotovljena=trenutnoUgotovljena;

                        var preostalih = igra.trenutnoUgotovljena.split("_").length-1;
                        if(preostalih==0){
                            //celotna beseda ugotovljena
                            var igralec = GetIgralecFromName(data.name,igra.players);
                            igralec.tock+=3;
                            igralec.vsehTock+=3;
                            igralec.zmag+=1;

                            status = data.name + " je uganil pravilno črko "+vnos +" in končal besedo.(+ 3 točke!)";
                            rundaKoncana = true;
                            igra.next();
                            for(var i = 0;i<igra.players.length;i++){
                                igra.players[i].status="Čaka";
                                igra.players[i].tock=0;
                            }
                        }
                        else{

                            var igralec = GetIgralecFromName(data.name,igra.players);
                            igralec.tock+=1;
                            igralec.vsehTock+=1;

                            status = data.name + " je uganil pravilno črko " + vnos + "(+ 1 točka!)";

                        }
                    }
                   else{
                        status = data.name + " je vpisal črko "+ vnos +", ki se v besedi ne pojavlja.";
                    }

               }
               else{
                   status = data.name + " je vpisal besedo \""+vnos;
                   if(vnos != beseda){
                       status +="\". Beseda je napacna.";
                   }
                   else{
                       status+="\" Ugotovil je besedo(+5 točk).";
                       var igralec = GetIgralecFromName(data.name,igra.players);
                       igralec.tock+=5;
                       igralec.vsehTock+=5;
                       igralec.zmag+=1;

                       igra.trenutnoUgotovljena=beseda;

                       rundaKoncana = true;
                       igra.next();
                       for(var i = 0;i<igra.players.length;i++){
                           igra.players[i].status="Čaka";
                           igra.players[i].tock=0;
                       }
                   }
               }
                igra.updateRoundStatus();
                igra.sendAll("vnos", {vnos:vnos,pravilen:false,beseda:igra.trenutnoUgotovljena,status:status, players:igra.players, konec:rundaKoncana});
    });

    socket.on("join-game", function(data){
       var game = games[data.id];
        igra = game;
        if(game==null){
            socket.emit("error", {status: "Igra ne obstaja."});
            return;
        }
        if(game.poteka){
            socket.emit("error", {status: "Izbrana igra je v teku."});
            return;
        }
        if(game.players.length==4){
            socket.emit("error", {status: "Igra je polna."});
            return;
        }

       var name = data.name;
       console.log("Player "+name+ " id: "+userId+ "joined game: "+ game.gameID);
        var player = createPlayer(name,userId,false);
        igra.sendAll("joined",player);

        game.players.push(player);
        socket.emit("joined-game",game);
    });
});

String.prototype.replaceAt=function(index, char) {
    return this.substr(0, index) + char + this.substr(index+char.length);
}


function GetIgralecFromName(name,players){
    console.log("looking for "+name);
    for(var i = 0;i<players.length;i++){
        if(players[i].name==name){
            return players[i];
        }
    }
    console.log("error, player with name "+name+" not found.");
}

function GetIgralecFromID(id,players){
    for(var i = 0;i<players.length;i++){
        if(players[i].id==id){
            return players[i];
        }
    }
    console.log("error, player with id "+id+" not found.");
}

Array.prototype.all=function(fn){
      for(var i = 0;i<this.length;i++){
          if(fn(this[i])==false){
              return false;
          }
      }
    return true;
};
Array.prototype.each=function(fn){
    for(var i = 0;i<this.length;i++){
        fn(this[i]);
    }
};

var gameCounter=0;
var userCounter=0;
function GAMEID ()
{
    return "game"+gameCounter++;
}
function USERID ()
{
    return "user"+userCounter++;
}

function GUID ()
{
    var S4 = function ()
    {
        return Math.floor(
                Math.random() * 0x10000 /* 65536 */
            ).toString(16);
    };

    return (
            S4() + S4() + "-" +
            S4() + "-" +
            S4() + "-" +
            S4() + "-" +
            S4() + S4() + S4()
        );
}