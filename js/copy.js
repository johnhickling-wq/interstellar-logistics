/* copy.js — the company's voice. All whimsy is quarantined here so the
   simulation stays dry and the prose stays drier. */
(function () {
  'use strict';
  window.CW = window.CW || {};

  var PREFIX = ['New', 'Little', 'Greater', 'Lesser', 'Upper', 'Nether', 'Old', 'Port', 'East', 'St.'];
  var ROOT = [
    'Basingstoke', 'Wapping', 'Kettering', 'Dunstable', 'Pimlico', 'Chigley',
    'Purbright', 'Woking', 'Frome', 'Cromer', 'Trumpington', 'Slough',
    'Ambridge', 'Tolworth', 'Nempnett', 'Wigan', 'Goole', 'Bletchley',
    'Rutland', 'Melton', 'Oswaldtwistle', 'Penge', 'Chalfont', 'Didcot',
  ];
  var SUFFIX = ['-on-Void', ' Reach', ' Halt', ' Junction', ' Parva', ' Magna', ' End', ' Hollow', '-under-Star', ' Annexe'];

  CW.makeNamePool = function (rng) {
    var names = [];
    ROOT.forEach(function (root) {
      var r = rng();
      if (r < 0.35) names.push(PREFIX[Math.floor(rng() * PREFIX.length)] + ' ' + root);
      else if (r < 0.75) names.push(root + SUFFIX[Math.floor(rng() * SUFFIX.length)]);
      else names.push(root);
    });
    // shuffle
    for (var i = names.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = names[i]; names[i] = names[j]; names[j] = t;
    }
    return names;
  };

  // Ship's Manifest — the one place the glyph mapping is taught.
  CW.MANIFEST = {
    water:     'Dihydrogen monoxide. Handle with towels.',
    food:      'Mostly edible.',
    energy:    'Contents may spark.',
    minerals:  'Assorted rocks of consequence.',
    machinery: 'Some assembly required.',
    medicine:  'Take twice daily, with gravity.',
    knowledge: 'Books. Heavier than they look.',
    culture:   'Theatre, mostly tragedies.',
    biology:   'Do not water after midnight.',
    luxuries:  'Non-essential. Utterly vital.',
  };

  CW.TAGLINES = [
    'Connecting frontier worlds since 1896.',
    'Route planning is everyone’s responsibility.',
    'Please submit Beacon Relay requests three working days in advance.',
    'Punctuality is a courtesy. Delivery is a contract.',
    'Proudly unremarkable across nine star systems.',
    'The universe is expanding. So is our service area.',
    'Lost cargo is merely cargo awaiting rediscovery.',
    'All complaints are read aloud at the Christmas party.',
  ];

  CW.SMALL_PRINT = 'Crump & Wainwright accepts no liability for cargo lost to ionised nebulae, temporal anomalies, or enthusiasm. Terms apply. Terms have always applied.';

  CW.toasts = {
    colonySpawn: function (c, typeName) {
      return c.name + ' chartered. It cannot produce its own ' + typeName.toLowerCase() + '.';
    },
    specialSpawn: function (c, typeName) {
      return c.name + ' is the sector’s ' + typeName + ' colony. Head Office is quietly pleased.';
    },
    industrialise: function (c, typeName) {
      return c.name + ' has industrialised. It now requires ' + typeName + '. Kindly adjust.';
    },
    firstLowReserve: 'A colony is running low. Colonies fail when their essential supply runs out.',
    distress: function (c, typeName) {
      return c.name + ' has exhausted its ' + typeName.toLowerCase() + ' reserve. Failure imminent.';
    },
    needRelay: 'That routing crosses an ionised nebula. A Beacon Relay is required.',
    noRelay: 'No Beacon Relays in stores. Requests may be granted at the weekly review.',
    noCorridor: 'All corridors are presently in service.',
    noShips: 'Corridor opened. No vessels in reserve — one may be assigned when available.',
    shipAssigned: 'Vessel assigned. It knows what to do.',
    podNoShip: 'A cargo pod requires a vessel to be attached to. This is considered best practice.',
    podFull: 'That vessel is already at maximum pod allowance (form CP-4 refers).',
    hubPlaced: function (c) { return c.name + ' upgraded to Orbital Logistics Hub. The canteen is much improved.'; },
    hintDraw: 'Drag between two colonies to open a hyperspace corridor.',
    hintExtend: 'Drag a corridor’s loose end to extend the route.',
    weekShip: 'One (1) additional freight vessel has been allocated to your fleet.',
  };

  CW.UPGRADE_TEXT = {
    corridor: { title: 'New Hyperspace Corridor', desc: function (colourName) {
      return 'One additional route, in a fetching shade of ' + colourName + '.'; } },
    pod:      { title: 'Cargo Pod', desc: function () {
      return 'Increases one vessel’s capacity by six crates.'; } },
    relay:    { title: 'Two Beacon Relays', desc: function () {
      return 'For crossing ionised nebulae, per form NB‑7.'; } },
    hub:      { title: 'Orbital Logistics Hub', desc: function () {
      return 'Expands a colony’s yard and speeds transfers.'; } },
    ship:     { title: 'Freight Vessel', desc: function () {
      return 'One additional vessel, lightly used.'; } },
  };

  CW.GAMEOVER_SIGNOFF = [
    'The kettle remains on.',
    'Mind the gap between expectation and delivery.',
    'A full inquiry will be held after lunch.',
    'Your parking allocation is unaffected.',
    'The Board notes that space is, on reflection, quite large.',
    'Form L-1 (Loss of Colony) is available from the second floor.',
    'We remain, as ever, entirely composed.',
  ];

  CW.gameOverMemo = function (colonyName, resourceName, days, delivered) {
    return 'It is with mild regret that the Board records the failure of ' +
      colonyName + ', following an interruption in the supply of ' +
      resourceName.toLowerCase() + '. The network operated for ' + days +
      (days === 1 ? ' day' : ' days') + ' and conveyed ' + delivered +
      (delivered === 1 ? ' consignment' : ' consignments') +
      ', which the Board considers respectable, all things considered.';
  };

  CW.WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
})();
