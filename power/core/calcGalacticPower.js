let debug = process.env.DEBUG

let iSkills = require('../../common/data/index_skills.json')
let gpTables = require('../../common/data/index_gpTables.json').tables

module.exports = async ( units ) => {
    var GP = []
    try {

        for( var un of units ) {
            if( un.combatType === 2 ) { continue; }
                un.gp = calcCharGP( un );
            GP.push({ unit:un.defId, gp:un.gp })
        }

        //Do ship gp
        for( var un of units ) {
            if( un.combatType === 1 ) { continue; }
            if( un.crew ) {
                for( var cmem of un.crew ) {
                  let u = units.filter(pr => pr.defId === cmem.unitId);
                  cmem.gp = u[0].gp || 0;
                  cmem.cp = calcCrewRating( cmem.gp, un );
                }
            }
            un.gp = calcShipGP( un );
            GP.push({ unit:un.defId, gp:un.gp })
        }

    } catch(e) {
        console.error(e);
    }
    return GP
}


function calcModGP( modList, raw ) {
    try {
        //pips:level:tier:set?
        //1:1:1:0 -> 7:15:5:8
        var gpMod = 0;
        if( raw ) {
            modList.forEach( m => {
                var key = m.definitionId.charAt(1)+":"+m.level+":"+m.tier+":"+m.definitionId.charAt(0);
                gpMod += parseInt(gpTables.modTable[key]);
            });
        } else {
            modList.forEach( m => {
                var key = m.pips+":"+m.level+":"+m.tier+":"+m.set;
                gpMod += parseInt(gpTables.modTable[key]);
            });
        }
        return gpMod;
    } catch(e) {
        console.error(e);
        return 0
    }
}

function calcAbilityGP( abilityList, combatType ) {
    try {
        var gpTotals = {
          gpAbility: 0,
          gpContract: 0,
          gpReinforcement: 0
        };
        abilityList.forEach( a => {
            let iskill
            let otag
            if (!a.tiers) {
                iskill = iSkills.find(i => i.id === a.id)
                otag = iskill.tiers[0].powerOverrideTag || ""
            }

            if( (a.tiers === 3 && combatType === 1) || ( otag && (a.id.includes('contract') || otag.includes('contract'))) ) {
              gpTotals.gpContract += Number(gpTables.contractTable[(a.tier || 0)]);
            } else if( (a.tiers === 3 && combatType === 2) || (otag && (a.id.includes('hardware') || otag.includes('reinforcement'))) ) {
              gpTotals.gpReinforcement += Number(gpTables.reinforcementTable[(a.tier-1 || 0)]);
            } else {
              gpTotals.gpAbility += a.tier === 8 && a.isZeta ? Number(gpTables.abilityTable[a.tier+1]) : Number(gpTables.abilityTable[(a.tier || 0)]);
            }
        });
        return gpTotals;
    } catch(e) {
        console.error(e);
        return 0
    }
}

function getGearGp(tier) {
    let gp = 0;

    if (tier < gpTables.gearTable.length) {
        gp = gpTables.gearTable[tier];
    }

    return gp;
}

function calcGearGP( tier, equipped ) {
    try {
        let gpGear = Number(gpTables.completedGearTable[tier-1]) +
            Number(getGearGp(tier)) * equipped.length;
        return gpGear;
    } catch(e) {
        console.error(e);
        return 0
    }
}



// === /player GP

function calcCharGP( unit ) {
    try {

        if( !unit ) { return false; }

        var gpModifier  = 1.5;
        var gpMod       = calcModGP( unit.mods );
        var {gpAbility, gpContract} = calcAbilityGP( unit.skills, unit.combatType );
        var gpGear      = calcGearGP( unit.gear, unit.equipped );
        var gpRarity    = gpTables.rarityTable[ unit.rarity ];
        var gpLevel     = gpTables.levelTable[ unit.level ];
        var relicGp     = 0;
        gpAbility += gpContract;

        if( debug ) console.log( gpMod, gpAbility, gpGear, gpRarity, gpLevel )

        if (unit.relic && unit.relic.currentTier > 2) {
            const currentRelicTier = unit.relic.currentTier - 2;
            relicGp = gpTables.gpPerRelicTable[ currentRelicTier ];
            relicGp += unit.level * gpTables.gpModiferRelicTable[ currentRelicTier ];
        }

        return Math.floor(( gpMod + gpAbility + gpGear + gpRarity + gpLevel + relicGp) * gpModifier);
    } catch(e) {
        console.error(e);
        return 0
    }
}

function calcCrewRating( gp, ship ) {
    try {

        return ((gp * gpTables.multiplierTable[ ship.rarity ]) * gpTables.crewSizeTable[ship.crew.length]);

    } catch(e) {
        console.error(e);
        return 0
    }
}


function calcShipGP( unit ) {
    try {

        if( !unit || !unit.crew ) { return 'error'; }

        var gpRarity    = parseFloat(gpTables.rarityTable[ unit.rarity ]);
        var gpCrewSize  = parseFloat(gpTables.crewSizeTable[unit.crew.length]);
        var gpLevel     = parseFloat(gpTables.levelTable[ unit.level ]);
        var {gpAbility, gpReinforcement} = calcAbilityGP( unit.skills , unit.combatType);
        var gpModifier  = parseFloat(gpTables.multiplierTable[unit.rarity]);

        var gpCrewPower = 0;
        var gpShipPower = 0;
        var gpCrew = 0;
        var gpTotal = 0;

        unit.crew.forEach( cmem => {
            gpCrewPower += parseFloat(cmem.cp);
            gpCrew += parseFloat(cmem.gp);
        });

        if (unit.crew.length === 0) {
          // TODO - update calculation when crewless ship with more than 3 abilities + reinforcement released?
          //const numOfAbilities = 3;
          //const gpPerAbilityModifier = gpTables.crewlessGPModiferPerAbilityTable[numOfAbilities];
          gpCrew = (gpLevel * 3.5 + gpAbility * 5.74 + gpReinforcement * 1.61) * gpModifier;
          gpTotal = (gpCrew + gpLevel + gpAbility + gpReinforcement) * 1.5;
        } else {
          gpCrew = gpCrew * gpModifier * gpCrewSize;
          gpShipPower = (( gpCrew / 2 ) + (( gpLevel + gpAbility + gpReinforcement) * 1.5));
          gpTotal = gpCrewPower + gpShipPower
        }

        if( debug ) console.log( gpRarity, gpCrewSize, gpLevel, gpAbility, gpModifier, gpCrewPower, gpShipPower, gpCrew )

        return Math.floor(gpTotal);
    } catch(e) {
        console.error(e);
        return 0
    }
}

