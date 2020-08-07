var map;
var userLocationMarker;

function initMap() {
    var startLocation = {lat: 60.221873, lng: 24.941422};
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 15,
        center: startLocation
    });
    userLocationMarker = new google.maps.Marker({
        position: startLocation,
        map: map,
        icon: 'pics/person.png'
    });
}

$(document).ready(function(){
	
	var SECONDS_IN_MINUTE = 60;
	var SECONDS_IN_HOUR = 60*60;
	var SECONDS_IN_DAY = 24*60*60;
	var distance = 1000;
	var timeRange = 59*60;
	var currentTime;
	var dataRefreshInterval = SECONDS_IN_MINUTE*1000;
	var busCodes = [701,702,704];
	var edges = [];
	
	function refreshData () {
    if (map===undefined) setTimeout(refreshData,1);
    else refresh();
  }

  if (navigator.geolocation) {
	    setTimeout(refreshData,0);
	}

	else showResult("Browser geolocation not available");
    
	function refresh() {
		document.getElementById("spinner").style.visibility="visible";
		navigator.geolocation.getCurrentPosition(
			geoSuccess, 
			function (){
				showResult("Failed to get device location");
				document.getElementById("spinner").style.visibility="hidden";
			}
		);
	}
	
	function clearStopMarkers() {
		edges.forEach(function(edge){
			if (edge.node.hasOwnProperty("marker") && edge.node.marker!==null) edge.node.marker.setMap(null);
		});
	}
	
	function createMarker (url,scale,lat,lon) {
		var image = {
				url: url,
				scaledSize: new google.maps.Size(scale, scale), // scaled size
			    origin: new google.maps.Point(0,0), // origin
			    anchor: new google.maps.Point(0, 0) // anchor
			};
			return new google.maps.Marker({
		          position: {
		        	  lat: lat,
		        	  lng: lon
		          },
		          map: map,
		          icon: image
		    });
	}
	
	function geoSuccess(location){
		if (edges.length>0) clearStopMarkers();
		
		var lat = location.coords.latitude;
		var lon = location.coords.longitude;
		map.setCenter({lat: lat, lng: lon}); 
		userLocationMarker.setPosition({lat: lat, lng: lon});
		var query = '{stopsByRadius(lat: '+lat+', lon: '+lon+', radius: '+distance+'){edges{node{distance stop{gtfsId name lat lon stoptimesWithoutPatterns(timeRange: '+timeRange+'){scheduledDeparture realtimeDeparture departureDelay realtime realtimeState serviceDay trip {tripHeadsign route{shortName longName type} alerts{alertDescriptionTextTranslations{text language}}}}}}}}}';
		queryDigitransit(query, querySuccess, queryFail, queryAlways);
		function querySuccess(response) {
	        var result = [];
			edges = response.data.stopsByRadius.edges;
			edges.forEach(function(edge){ 
			    var node = edge.node;
				var departures = node.stop.stoptimesWithoutPatterns;
				departures.forEach(function(departure){	
				    result.push({
				        departure: departure,
					    node: node	
				    }); 
				});
				if (departures.length>0 && busCodes.indexOf(departures[0].trip.route.type)>-1) node.marker = createMarker('pics/bus.png', 20, node.stop.lat, node.stop.lon);
				else if (departures.length>0) node.marker = createMarker('pics/train.png', 20, node.stop.lat, node.stop.lon);
				

			});
			result.sort(function(a,b){
				if (a.departure.trip.route.shortName < b.departure.trip.route.shortName) return -1;
				if (a.departure.trip.route.shortName > b.departure.trip.route.shortName) return 1;
				if (a.departure.trip.tripHeadsign < b.departure.trip.tripHeadsign) return -1;
				if (a.departure.trip.tripHeadsign > b.departure.trip.tripHeadsign) return 1;
				if (a.node.distance < b.node.distance) return -1;
				if (a.node.distance > b.node.distance) return 1;
				if (a.node.stop.name < b.node.stop.name) return -1;
				if (a.node.stop.name > b.node.stop.name) return 1;
				if ((a.departure.serviceDay+a.departure.realtimeDeparture) < 
                (b.departure.serviceDay+b.departure.realtimeDeparture)) return -1;
				if ((a.departure.serviceDay+a.departure.realtimeDeparture) > 
                (b.departure.serviceDay+b.departure.realtimeDeparture)) return 1;
				return 0; 
			});
			var resultArray = [];
			var lastShortName = "";
			var lastTripHeadsign = "";
			for (var i=0; i<result.length; i++) {
				var obj = result[i];
				if (obj.departure.trip.route.shortName!==lastShortName || 
					obj.departure.trip.tripHeadsign!==lastTripHeadsign) {
					    resultArray.push([obj]);
				}
				else resultArray[resultArray.length-1].push(obj);
				lastShortName = obj.departure.trip.route.shortName;
				lastTripHeadsign = obj.departure.trip.tripHeadsign;
			}
			resultArray.sort(function(a,b){
				return (a[0].departure.serviceDay+a[0].departure.realtimeDeparture) -
				       (b[0].departure.serviceDay+b[0].departure.realtimeDeparture);	
			});
			showResult(resultArray,edges);
			setTimeout(refresh,dataRefreshInterval);    
		}
		
		function queryFail() {
			showResult("Connection failed");
			
		}
		function queryAlways(){
			document.getElementById("spinner").style.visibility="hidden";
		}
	}
	  
	function showResult(result,edges) {
		var selectedRow = {
			tr : null,
			node: null,
			departure: null
		};
		var tbody = document.getElementById("tbody");
		while (tbody.firstChild) {
		    tbody.removeChild(tbody.firstChild);
		}
		if (typeof result === "string") {
			addError(result);
		}
		else {
			updateCurrentTime();
			result.forEach(function(arr){
				arr.forEach(function(obj,index){
					var tr;
					if (index===0 || obj.node.stop.name!==arr[index-1].node.stop.name || 
							         obj.node.distance!==arr[index-1].node.distance) {
						tr = addRow(timeShown(obj.departure.serviceDay+obj.departure.realtimeDeparture-currentTime),
							   obj.node.stop.name,	obj.node.distance+"m", 
							   obj.departure.trip.route.shortName+" "+obj.departure.trip.tripHeadsign,
							   obj.departure.trip.route.longName);
						tbody.lastChild.className="firstRowOfStop";
					}	
					else tr = addRow(timeShown(obj.departure.serviceDay+obj.departure.realtimeDeparture-currentTime),"","","","");
					var span = document.createElement("span");
					span.id = "iconContainer";
					if (index===0) {
						if(arr.length>1) {
						    var sp = document.createElement("span");
						    sp.className="moreIcon";
						    var i = document.createElement("i");
						    i.className = "fas fa-angle-double-down";
						    sp.appendChild(i);
						    span.appendChild(sp);
						    sp = document.createElement("span");
						    sp.className= "lessIcon";
						    i = document.createElement("i");
						    i.className = "fas fa-angle-double-up";
						    sp.appendChild(i);
						    sp.style.display="none";
						    span.appendChild(sp);
						}
						tr.className="firstRow";
					}
					else tr.style.display="none";
					tr.lastChild.appendChild(span);
					
					
					tr.addEventListener("click",function(event){
						if (selectedRow.tr===tr) {
							tr.style.backgroundColor="";
							obj.node.marker.setMap(null);
							if(busCodes.indexOf(obj.departure.trip.route.type)>-1) 
							    obj.node.marker = createMarker('pics/bus.png', 20, obj.node.stop.lat, obj.node.stop.lon);
							else obj.node.marker = createMarker('pics/train.png', 20, obj.node.stop.lat, obj.node.stop.lon);
							selectedRow.tr = null;
							selectedRow.node = null;
							map.setCenter(userLocationMarker.getPosition()); 
						}
						else {
							if (selectedRow.tr!==null) {
								selectedRow.tr.style.backgroundColor="";
								selectedRow.node.marker.setMap(null);
								
								if(busCodes.indexOf(obj.departure.trip.route.type)>-1) 
								    selectedRow.node.marker = createMarker('pics/bus.png', 20, selectedRow.node.stop.lat, selectedRow.node.stop.lon);
								else selectedRow.node.marker = createMarker('pics/train.png', 20, selectedRow.node.stop.lat, selectedRow.node.stop.lon);
							}
							tr.style.backgroundColor = "yellow";
							obj.node.marker.setMap(null);
							
							if(busCodes.indexOf(obj.departure.trip.route.type)>-1) 
							    obj.node.marker = createMarker('pics/yellowbus.png', 40, obj.node.stop.lat, obj.node.stop.lon);
							else obj.node.marker = createMarker('pics/yellowtrain.png', 40, obj.node.stop.lat, obj.node.stop.lon);
							map.setCenter({lat: obj.node.stop.lat, lng: obj.node.stop.lon}); 
							selectedRow = {
								tr: tr,
								node: obj.node
							};
						}
					});
				});
			});
			
			
		}
		
		
		function addRow(time, stopName, distance, shortName, longName) {
			var tr = document.createElement("tr");
			addCell(time,tr);
			addCell(stopName,tr);
			addCell(distance,tr);
			var lastCell = addCell(shortName,tr);
			lastCell.setAttribute("title", longName);
			tbody.appendChild(tr);
			return tr;
		}
		
        function addError(message){
        	var span = document.createElement("span");
        	span.className += ""+"errorText";
        	span.textContent = message;
        	document.getElementById("error").appendChild(span);
		}
        
		function addCell(val,tr) {
			var td = document.createElement("td");
			td.textContent = val;
			tr.appendChild(td);
			return td;
		}
		
		Array.prototype.forEach.call(document.getElementsByClassName("moreIcon"),function(icon){
			icon.addEventListener("click",function(event){
				event.stopPropagation();
				icon.nextSibling.style.display="inline";
				icon.style.display="none";
				var tr = icon.parentNode.parentNode.parentNode;
				while(tr.nextSibling && tr.nextSibling.style.display==="none") {
					tr.nextSibling.style.display="table-row";
					tr = tr.nextSibling;
				}
			});
		});
		
		Array.prototype.forEach.call(document.getElementsByClassName("lessIcon"),function(icon){
			icon.addEventListener("click",function(event){
				event.stopPropagation();
				icon.previousSibling.style.display="inline";
				icon.style.display="none";
				var tr = icon.parentNode.parentNode.parentNode;
				while(tr.nextSibling && tr.nextSibling.style.display==="table-row") {
					tr.nextSibling.style.display="none";
					tr = tr.nextSibling;
				}
			});
		});
	}
	
	function updateCurrentTime() {
		currentTime = (Date.now()/1000)>>0;
	}
	
	function timeShown(seconds) {
    if (seconds<0) seconds+=SECONDS_IN_HOUR;
		var days = seconds/SECONDS_IN_DAY>>0;
		seconds -= days*SECONDS_IN_DAY;
		var hours = seconds/SECONDS_IN_HOUR>>0;
		seconds -= hours*SECONDS_IN_HOUR;
		var minutes = seconds/SECONDS_IN_MINUTE>>0;
		seconds -= minutes*SECONDS_IN_MINUTE;
		var result = minutes + " min";
		if (hours>0) result = hours + " h " + result;
		if (days>0) result = days + " d " + result;
		return result;
	}
    
	function distance(lat1, lon1, lat2, lon2, unit) {
		var radlat1 = Math.PI * lat1/180;
		var radlat2 = Math.PI * lat2/180;
		var theta = lon1-lon2;
		var radtheta = Math.PI * theta/180;
		var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
		dist = Math.acos(dist);
		dist = dist * 180/Math.PI;
		dist = dist * 60 * 1.1515;
		if (unit=="K") dist = dist * 1.609344;
		if (unit=="N") dist = dist * 0.8684;
		return dist;
	}
	
	function queryDigitransit (queryString, success, fail, always) {
	    var url = "https://api.digitransit.fi/routing/v1/routers/hsl/index/graphql";
	    var qs = JSON.stringify({
		    query: queryString
		});
	
	    var jqxhr= $.ajax({
	        type: "POST",
		    url: url,
	        data: qs,
	        headers: {
		        "Accept": "application/json; charset=utf-8",         
		        "Content-Type": "application/json; charset=utf-8"  
	        }
	    });
	    if(typeof success==="function") jqxhr.done(success);
	    if(typeof fail==="function") jqxhr.fail(fail);
	    if(typeof always==="function") jqxhr.always(always);
	}
	
});



