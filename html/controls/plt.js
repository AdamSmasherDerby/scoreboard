$(initialize("1")); //TODO make this an input parameter, not a fixed "team 1"
/**
 * This file is part of the Carolina Rollergirls (CRG) ScoreBoard.
 * The CRG ScoreBoard is licensed under either the GNU General Public
 * License version 3 (or later), or the Apache License 2.0, at your option.
 * See the file COPYING for details.
 */
var lineups = {};

function initialize(t) {
	WS.Connect();
	WS.AutoRegister();
	
	WS.Register([ 'ScoreBoard.Team(' + t + ').Name' ], function(k,v) {
		$('#tableDiv table.Team' + t +' th.Team a.Team').html(v);
	});
	
	WS.Register(['ScoreBoard.Stats'], function(k,v) {
		processStats(k,v,t);
	});
	
	WS.Register(['ScoreBoard.Team('+t+').Skater'], function(k,v) {
	});
	
	WS.Register(['ScoreBoard.Clock']);
	WS.Register(['ScoreBoard.Clock(Jam).Running'] , function() {
	})
}



var skaterRE = /ScoreBoard\.Stats\.Period\((\d)\)\.Jam\((\d+)\)\.Team\((\d)\)\.Skater\((\S+)\)\.Position/
function processStats(k,v,t) {
	var match = k.match(skaterRE);
	if (match == null || match.length == 0 || match[3] != t) { return; }
	var period = match[1];
	var jam = match[2];
	var id = match[4];
	
	if (!lineups.hasOwnProperty(period)) {lineups[period] = {}};
	if (!lineups[period].hasOwnProperty(jam)) {lineups[period][jam] = {}};
	//console.log('MatchID: ' +  id + ' Number ' + WS.state['ScoreBoard.Team('+t+').Skater('+id+').Number'] + ' Position: ' + v);
	lineups[period][jam][v] = WS.state['ScoreBoard.Team('+t+').Skater('+id+').Number'];
	console.log(lineups)
}

function makeLineupTable(t) {
	var period = WS.state['ScoreBoard.Clock(Period).Number'];
	var jam = WS.state['ScoreBoard.Clock(Jam).Number'];
	var lineup = {};
	
	for(var p = 1; p <= period; p++) {
		for(var j = 1; j < jam; j++) {
		}
	}
}
/*

var POSITIONS = "Bench Jammer Blocker Pivot Ineligible";
var POSITIONS_ARRAY = [ "Bench", "Jammer", "Blocker", "Pivot" ];
var POSITIONS_REGEX = /^(Bench|Jammer|Blocker|Pivot|Ineligible)$/;

function createTeamTable(t) {
	var team = $sb("ScoreBoard.Team("+t+")");
	var table = $("#tableDiv table.Template").clone().removeClass("Template").addClass("Team"+t)
		.appendTo("#tableDiv");
	table.sortedtable({ header: table.find("thead tr:eq(1)") });
	team.$sb("Name").$sbElement(table.find("th.Team a.Team"));

	team.$sbBindAddRemoveEach("Skater", function(event, skater) {
		var row = table.find("tr.Template").clone().removeClass("Template").attr("data-id", skater.$sbId);
		skater.$sb("Name").$sbElement(row.find("td>a.Name"));
		skater.$sb("Number").$sbElement(row.find("td>a.Number"));
		skater.$sb("Role").$sbBindAndRun("sbchange", function(event, value) {
			if (POSITIONS_REGEX.test(value))
				row.removeClass(POSITIONS).addClass(value);
		});
		skater.$sb("PenaltyBox").$sbBindAndRun("sbchange", function(event, value) {
			row.find("td.Box").toggleClass("InBox", isTrue(value));
		});

		row.find("td.Position").click(function() {
			var td = $(this);
			$.each( POSITIONS_ARRAY, function(i, e) {
				if (td.hasClass(e)) {
					if (td.parent().hasClass(e)) // already set to this position
						return false;
					skater.$sb("Role").$sbSet(e);
					return false;
				}
			});
		});

		row.find("td.Box").click(function() {
			var inBox = $(this).hasClass("InBox");
			skater.$sb("PenaltyBox").$sbSet(String(!inBox));
		});

		table.sortedtable("insert", row);
	}, function(event, skater) {
		table.find("tr[data-id='"+skater.$sbId+"']").remove();
	});

}*/
//# sourceURL=controls\plt.js