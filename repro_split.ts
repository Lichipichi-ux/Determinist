
// Simulation of Account Logic

interface Entry {
    debit: number;
    credit: number;
}

interface Account {
    balance: number;
    entries: Entry[];
}

function calculateTotals(entries: Entry[]) {
    const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);
    return { totalDebit, totalCredit, balance: totalDebit - totalCredit };
}

console.log("--- TEST CASE 1: DEBIT NATURE ACCOUNT (Original Balance 500) ---");
let entriesDebit: Entry[] = [{ debit: 500, credit: 0 }];
console.log("Initial:", calculateTotals(entriesDebit));

const splitAmount = 345;

// Current Logic (Credit to reduce Debit)
const currentAdjDebit = { debit: 0, credit: 345 };
const entriesDebitCurrent = [...entriesDebit, currentAdjDebit];
console.log("Current Logic Result:", calculateTotals(entriesDebitCurrent));

// Proposed Logic (Negative Debit)
const proposedAdjDebit = { debit: -345, credit: 0 };
const entriesDebitProposed = [...entriesDebit, proposedAdjDebit];
console.log("Proposed Logic Result:", calculateTotals(entriesDebitProposed));


console.log("\n--- TEST CASE 2: CREDIT NATURE ACCOUNT (Original Balance -500) ---");
let entriesCredit: Entry[] = [{ debit: 0, credit: 500 }]; // Credit 500 means balance -500 usually? 
// Wait, in this app:
// runBal = runBal + e.debit - e.credit;
// So Credit 500 -> Balance -500. Correct.
console.log("Initial:", calculateTotals(entriesCredit));

// Current Logic (Debit to reduce Credit)
const currentAdjCredit = { debit: 345, credit: 0 };
const entriesCreditCurrent = [...entriesCredit, currentAdjCredit];
console.log("Current Logic Result:", calculateTotals(entriesCreditCurrent));

// Proposed Logic (Negative Credit)
const proposedAdjCredit = { debit: 0, credit: -345 };
const entriesCreditProposed = [...entriesCredit, proposedAdjCredit];
console.log("Proposed Logic Result:", calculateTotals(entriesCreditProposed));
