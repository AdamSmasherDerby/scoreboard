$(initialize);

var penaltyEditor = null;
var period = null;
var jam = null;
var teamId = null;
var skaterId = null;
var penaltyId = null;
var fo_exp = null;

function initialize() {
// Register websocket connections.
	
	WS.Connect();
	WS.AutoRegister();

	// Register connections and callbacks - if the team color changes, update the CSS 
	$.each([1, 2], function(idx, t) {
		WS.Register([ 'ScoreBoard.Team(' + t + ').Name' ]); 
		WS.Register([ 'ScoreBoard.Team(' + t + ').AlternateName' ]);
		WS.Register([ 'ScoreBoard.Team(' + t + ').Color' ], function(k, v) { 
			$('.Team' + t + 'custColor').css('color', WS.state['ScoreBoard.Team(' + t + ').Color(overlay_fg)']); 
			$('.Team' + t + 'custColor').css('background-color', WS.state['ScoreBoard.Team(' + t + ').Color(overlay_bg)']); 
			$('#head' + t).css('background-color', WS.state['ScoreBoard.Team(' + t + ').Color(overlay_bg)']); 
		});
	});
	
	// When the period clock or jam changes, update the local variable
	WS.Register( [ 'ScoreBoard.Clock(Period).Number' ], function(k, v) { period = v; });
	WS.Register( [ 'ScoreBoard.Clock(Jam).Number' ], function(k, v) { jam = v; });

	// When a skater record changes, pass the key and value for the changed object to the 
	// skaterUpdate function, along with the team number.
	WS.Register( [ 'ScoreBoard.Team(1).Skater' ], function(k, v) { skaterUpdate(1, k, v); } ); 
	WS.Register( [ 'ScoreBoard.Team(2).Skater' ], function(k, v) { skaterUpdate(2, k, v); } ); 

}

function adjust(which, inc) {
	var elem = $(".PenaltyEditor ." + which);
	console.log(elem, elem.val(), inc);
	elem.val(parseInt(elem.val()) + inc);
}

function clear() {
	console.log(penaltyId, skaterId);
	if (penaltyId == null || skaterId == null) {
		penaltyEditor.dialog("close");
	} else {
		WS.Command("Penalty", { teamId: teamId, skaterId: skaterId, penaltyId: penaltyId, fo_exp: fo_exp, jam: 0, period: 0 });
		penaltyEditor.dialog('close');
	}
}

var skaterIdRegex = /Skater\(([^\)]+)\)/;
var penaltyRegex = /Penalty\(([^\)]+)\)/;
function skaterUpdate(t, k, v) { 
// Given a team number, key, and value from a change in a skater object, update the whiteboard
// accordingly. Key can either refer to a penalty object within a skater object, or be a
// skater number object, indicating a reload of the board or a new game.

	// Extract the skater ID from the object.  Return if no match.
	match = k.match(skaterIdRegex);
	if (match == null || match.length == 0)
		return;
	var id = match[1];
	var prefix = 'ScoreBoard.Team(' + t + ').Skater(' + id + ')';
	
	if (k == prefix + '.Number') { 
	// This branch fires when a new game is started or the window is launched. 
	// It will be triggered individually for each skater.
		
		// Remove the skater's row from the table
		$('.Team' + t + ' .Skater[id=' + id + ']').remove();
		
		// If there's no value associated with the event, return
		if (v == null) {
			return;
		}

		// Add the row for this skater
		makeSkaterRows(t, id, v);
		
		// Repopulate the penalty boxes for this skater
		for (var i = 1; i <= 9; i++) 
			displayPenalty(t, id, i); 
		
		// And populate the foulout box
		displayPenalty(t, id, 'FO_EXP'); 
	} else {  
		// If this event isn't a skater, it's a penalty.  Note that four events fire per penalty,
		// so the regex will fail three times.
		
		// Determine the penalty number, quit if not found
		match = k.match(penaltyRegex);
		if (match == null || match.length == 0)
			return;
		var p = match[1];
		
		// Add the penalty to the display
		displayPenalty(t, id, p);
	}
}

function displayPenalty(t, s, p) {
// Given a team number, skater ID, and penalty number, add that penalty to the display
	
	// Set up element references
	var penaltyBox = $('.Team' + t + ' .Skater.Penalty[id=' + s + '] .Box' + p);
	var jamBox = $('.Team' + t + ' .Skater.Jam[id=' + s + '] .Box' + p);
	var totalBox = $('.Team' + t + ' .Skater.Penalty[id=' + s + '] .Total');

	// Retrieve the penalty code from the server
	var prefix = 'ScoreBoard.Team(' + t + ').Skater(' + s + ').Penalty(' + p + ')';
	code = WS.state[prefix + ".Code"];

	if (code != null) {
	// If the code exists, add the skater ID as data for the penalty and jam boxes, and
	// update the text
		penaltyBox.data("id", WS.state[prefix + ".Id"]);
		jamBox.data("id", WS.state[prefix + ".Id"]);
		penaltyBox.text(WS.state[prefix + ".Code"]);
		jamBox.text(WS.state[prefix + ".Period"] + '-' + WS.state[prefix + ".Jam"]);
	} else {
	// If no code exists, the operator cleared a penalty - remove it from the table.
		penaltyBox.data("id", null);
		jamBox.data("id", null);
		penaltyBox.html("&nbsp;");
		jamBox.html("&nbsp;");
	}

	// Count the total penalties for each skater and update the display
	var cnt = 0;
	$('.Team' + t + ' .Skater.Penalty[id=' + s + '] .Box').each(function(idx, elem) { cnt += ($(elem).data("id") != null ? 1 : 0); });
	totalBox.text(cnt);
	
	// Recolor the lines based on the number of penalties or foulout/expulsion status.
	var fo_exp = ($($('.Team' + t + ' .Skater.Penalty[id=' + s + '] .BoxFO_EXP')[0]).data("id") != null);
	$('.Team' + t + ' .Skater[id=' + s + ']').toggleClass("Warn1", cnt == 5 && !fo_exp);
	$('.Team' + t + ' .Skater[id=' + s + ']').toggleClass("Warn2", cnt == 6 && !fo_exp);
	$('.Team' + t + ' .Skater[id=' + s + ']').toggleClass("Warn3", cnt > 6 || fo_exp);
}

function makeSkaterRows(t, id, number) {
// Given a team, skater id, and skater number, recreate the header row for that team and 
// the table row for that skater.
	
	// Define table elements
	var team = $('.Team' + t + ' tbody');
	var head = document.getElementById('head' + t);
	
	// Retrieve team information from server
	var teamName = WS.state['ScoreBoard.Team(' + t + ').Name'];
	var teamFColor = WS.state['ScoreBoard.Team(' + t + ').Color(overlay_fg)'];
	var teamBColor = WS.state['ScoreBoard.Team(' + t + ').Color(overlay_bg)'];	
	if (WS.state['ScoreBoard.Team(' + t + ').AlternateName(whiteboard)'] != null) {
		teamName = WS.state['ScoreBoard.Team(' + t + ').AlternateName(whiteboard)']
	}

	// Update table header
	head.innerHTML = '<span class="Team' + t + 'custColor"; style="font-size: 200%;">' + teamName + '</span>';
	$('.Team' + t + 'custColor').css('color', teamFColor);
	$('.Team' + t + 'custColor').css('background-color', teamBColor);
	
	// Generate row for the skater. The actual penalties will be added by the "displayPenalty" function.
	// This just makes the table with no text except skater numbers
	var p = $('<tr>').addClass('Skater Penalty').attr('id', id).data('number', number);
	p.append($('<td>').attr('rowspan', 1).text(number));
	$.each([1, 2, 3, 4, 5, 6, 7, 8, 9], function(idx, c) {
		p.append($('<td>').addClass('Box Box' + c).html('&nbsp;'));
	});
	p.append($('<td>').addClass('BoxFO_EXP').html('&nbsp;'));
	p.append($('<td>').attr('rowspan', 1).addClass('Total').text('0'));

	// Insert the row into the table in the correct order based on the skater number
	var inserted = false;
	team.find('tr.Penalty').each(function (idx, row) {
		row = $(row);
		if (row.data('number') > number) {
			row.before(p);
			inserted = true;
			return false;
		}
	});
	if (!inserted) {
		team.append(p);
  }
}


