$(initialize);

var period = null;
var jam = null;
var jammerList = {};

function initialize() {
	jammerList = {};
	
	WS.Connect();
	WS.AutoRegister();

	$.each([1, 2], function(idx, t) {
		WS.Register([ 'ScoreBoard.Team(' + t + ').Name' ]); 
		WS.Register([ 'ScoreBoard.Team(' + t + ').AlternateName' ]);
		WS.Register([ 'ScoreBoard.Team(' + t + ').Color' ], function(k, v) { 
			$('.Team' + t + 'custColor').css('color', WS.state['ScoreBoard.Team(' + t + ').Color(overlay_fg)']); 
			$('.Team' + t + 'custColor').css('background-color', WS.state['ScoreBoard.Team(' + t + ').Color(overlay_bg)']); 
			$('#head' + t).css('background-color', WS.state['ScoreBoard.Team(' + t + ').Color(overlay_bg)']); } );
	});
	WS.Register( [ 'ScoreBoard.Clock(Period).Number' ], function(k, v) { period = v; });
	WS.Register( [ 'ScoreBoard.Clock(Jam).Number' ], function(k, v) { jam = v; });

	WS.Register( [ 'ScoreBoard.Team(1).Skater' ]); 
	WS.Register( [ 'ScoreBoard.Team(2).Skater' ]); 

	WS.Register( [ 'Game' ], function(k,v){
		processEvent(k,v);
	})
}

var jammerRegexp = /Game\.Period\(\d\)\.Jam\(\d\)\.Team\((\d)\)\.Skater\(Jammer\)\.Id/;

function processEvent(k, v) {
	var prefix = '';
	var team = '';
	var teamTable;
	console.log(k,v);
	
	// If this is a jammer, add them to the list
	var match = k.match(jammerRegexp);
	if (match != null && v != null){
		team = match[1];
		teamTable = $('.Team' + team + ' tbody');
		prefix = 'ScoreBoard.Team(' + team + ').Skater(' + v + ')';

		if (!jammerList.hasOwnProperty(v)){
		// If this is a new jammer, add them to the jammer list, and add a row to the display
			jammerList[v] = {
				name: WS.state[prefix + '.Name'],
				number: WS.state[prefix + '.Number'],
				team: team
			}
			console.log(jammerList);
			teamTable.append(makeJammerRow(v));
		}
		
		var jammerRow = teamTable.find('tr').filter(function() {return $(this).data('number') == jammerList[v].number})
		console.log(WS.state['Game.Period(' + period + ').Jam(' + jam + ').JamLength']);
		if (WS.state['Game.Period(' + period + ').Jam(' + jam + ').JamLength'] == '0:00') {
			console.log('here');
			jammerRow.find('td.Jams').html(+jammerRow.find('td.Jams').html() + 1);
		}
		
		}
}

function makeJammerRow(id) {
// Given a jammer ID, return a row for the table
	var row = $('<tr>').addClass('Jammer').data('number', jammerList[id].number);
	row.append($('<td>').addClass('Name').html(jammerList[id].name + ' (' + jammerList[id].number + ')'));
	row.append($('<td>').addClass('Jams').html('0'));
	row.append($('<td>').addClass('Lead').html('0'));
	row.append($('<td>').addClass('LeadPct').html('0'));
	row.append($('<td>').addClass('Box').html('0'));
	row.append($('<td>').addClass('Pts').html('0'));
	row.append($('<td>').addClass('Dif').html('0'));
	
	return row;
}