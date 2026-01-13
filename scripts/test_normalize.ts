import { normalizePhoneNumber } from '../src/lib/utils';

const testCases = [
    { input: '18569936360', expected: '+18569936360' },
    { input: '+18569936360', expected: '+18569936360' },
    { input: '(856) 993-6360', expected: '+18569936360' },
    { input: '856-993-6360', expected: '+18569936360' },
    { input: '856 993 6360', expected: '+18569936360' },
    { input: '8569936360', expected: '+18569936360' },
];

let failed = false;

testCases.forEach(({ input, expected }) => {
    const result = normalizePhoneNumber(input);
    if (result !== expected) {
        console.error(`FAILED: Input "${input}" -> Expected "${expected}", Got "${result}"`);
        failed = true;
    } else {
        console.log(`PASSED: Input "${input}" -> "${result}"`);
    }
});

if (failed) {
    process.exit(1);
} else {
    console.log('All tests passed!');
}
