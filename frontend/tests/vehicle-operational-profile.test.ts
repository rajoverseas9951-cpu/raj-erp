import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const profile=readFileSync(new URL('../app/vehicles/[vehicleId]/page.tsx',import.meta.url),'utf8');
const operation=readFileSync(new URL('../app/vehicles/[vehicleId]/operations/[module]/page.tsx',import.meta.url),'utf8');
const api=readFileSync(new URL('../lib/vehicle-operations.ts',import.meta.url),'utf8');

test('vehicle profile renders backend-owned responsive module groups',()=>{
 assert.match(profile,/profile\.applicability\.groups/); assert.match(profile,/sm:grid-cols-2 xl:grid-cols-4/); assert.doesNotMatch(profile,/function tabsFor/);
});
test('operation screen exposes current status, visible history and mutation controls',()=>{
 for(const label of ['Add New','Current Status','History','Search history','Edit','Delete','Supporting Document'])assert.match(operation,new RegExp(label));
});
test('client uses operational profile and history endpoints',()=>{
 assert.match(api,/operational-profile/); assert.match(api,/operations\/\$\{module\}/); assert.match(api,/counter_tax/); assert.match(api,/agent_payment/);
});
