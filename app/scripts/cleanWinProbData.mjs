/**
 * Script to delete win probability data points within a specified time range
 * Run with: node cleanWinProbData.mjs --week=4 --start="Mon 12:15 AM" --end="Tue 11:59 PM" [--execute]
 */

// # Preview deleting Monday 12: 15 AM through Tuesday 11: 59 PM for Week 4
// node cleanWinProbData.mjs --week=4 --start="Mon 12:15 AM" --end="Tue 11:59 PM"

// # Execute deletion of all Tuesday data for Week 12
// node cleanWinProbData.mjs --week=12 --start="Tue 12:00 AM" --end="Tue 11:59 PM" --execute

// # Delete everything after Monday 12: 15 AM for Week 4
// node cleanWinProbData.mjs --week=4 --start="Mon 12:15 AM" --end="Sat 11:59 PM" --execute

// # Delete only Wednesday data
// node cleanWinProbData.mjs --week=4 --start="Wed 12:00 AM" --end="Wed 11:59 PM" --execute

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, terminate } from 'firebase/firestore';

// Firebase config - use actual config from your project
const firebaseConfig = {
    apiKey: "AIzaSyD-wNzUysL_Fm-5S-Rvvey9WLJZIheWvVU",
    authDomain: "bokchoyleague.firebaseapp.com",
    projectId: "bokchoyleague",
    storageBucket: "bokchoyleague.firebasestorage.app",
    messagingSenderId: "566835598665",
    appId: "1:566835598665:web:880217b1673beb7ff07698",
    measurementId: "G-VZ43L4BECL"
};

// Initialize Firebase
if (!getApps().length) {
    initializeApp(firebaseConfig);
}
const db = getFirestore();

/**
 * Parse command line arguments
 */
function parseArguments() {
    const args = process.argv.slice(2);
    let week = null;
    let startTime = null;
    let endTime = null;
    let shouldExecute = false;

    for (const arg of args) {
        if (arg.startsWith('--week=')) {
            const weekStr = arg.split('=')[1];
            const parsedWeek = parseInt(weekStr, 10);
            if (!isNaN(parsedWeek) && parsedWeek > 0 && parsedWeek <= 18) {
                week = parsedWeek;
            } else {
                console.error(`❌ Invalid week: ${weekStr}. Must be between 1 and 18.`);
                process.exit(1);
            }
        } else if (arg.startsWith('--start=')) {
            startTime = arg.split('=')[1].replace(/"/g, '');
        } else if (arg.startsWith('--end=')) {
            endTime = arg.split('=')[1].replace(/"/g, '');
        } else if (arg === '--execute') {
            shouldExecute = true;
        } else if (arg === '--help' || arg === '-h') {
            showUsage();
            process.exit(0);
        } else {
            console.error(`❌ Unknown argument: ${arg}`);
            showUsage();
            process.exit(1);
        }
    }

    if (week === null) {
        console.error('❌ Week parameter is required!');
        showUsage();
        process.exit(1);
    }

    if (!startTime || !endTime) {
        console.error('❌ Both start and end time parameters are required!');
        showUsage();
        process.exit(1);
    }

    // Validate time formats
    if (!validateTimeFormat(startTime) || !validateTimeFormat(endTime)) {
        console.error('❌ Invalid time format! Use format like "Mon 12:15 AM" or "Tue 11:59 PM"');
        showUsage();
        process.exit(1);
    }

    return { week, startTime, endTime, shouldExecute };
}

/**
 * Validate time format
 */
function validateTimeFormat(timeStr) {
    const timeRegex = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i;
    return timeRegex.test(timeStr);
}

/**
 * Show usage instructions
 */
function showUsage() {
    console.log('\n📖 USAGE:');
    console.log('=========');
    console.log('node cleanWinProbData.mjs --week=<number> --start="<day time>" --end="<day time>" [--execute]');
    console.log('');
    console.log('Time Format: "<Day> <Hour>:<Minute> <AM/PM>"');
    console.log('Days: Sun, Mon, Tue, Wed, Thu, Fri, Sat');
    console.log('');
    console.log('Examples:');
    console.log('  # Preview deleting Mon 12:15 AM through Tue 11:59 PM for Week 4');
    console.log('  node cleanWinProbData.mjs --week=4 --start="Mon 12:15 AM" --end="Tue 11:59 PM"');
    console.log('');
    console.log('  # Execute deletion of all Tuesday data for Week 12');
    console.log('  node cleanWinProbData.mjs --week=12 --start="Tue 12:00 AM" --end="Tue 11:59 PM" --execute');
    console.log('');
    console.log('  # Delete everything after Monday 12:15 AM for Week 4');
    console.log('  node cleanWinProbData.mjs --week=4 --start="Mon 12:15 AM" --end="Sat 11:59 PM" --execute');
    console.log('');
    console.log('Options:');
    console.log('  --week=<1-18>        Target week to clean (required)');
    console.log('  --start="<day time>" Start of deletion range (required)');
    console.log('  --end="<day time>"   End of deletion range (required)');
    console.log('  --execute            Actually perform the cleanup (optional, defaults to preview)');
    console.log('  --help, -h           Show this help message');
    console.log('');
    console.log('Note: Data points with timestamps between start and end (inclusive) will be deleted.');
}

/**
 * Properly close Firebase connection and exit
 */
async function cleanupAndExit(code = 0) {
    try {
        console.log('\n🔒 Closing Firebase connection...');
        await terminate(db);
        console.log('✅ Connection closed successfully');
        process.exit(code);
    } catch (error) {
        console.error('❌ Error closing Firebase connection:', error);
        process.exit(1);
    }
}

/**
 * Check if document ID corresponds to target week
 * Expected format: year_week_matchupid (e.g., "2025_4_0")
 */
function isTargetWeekDocument(docId, targetWeek) {
    const parts = docId.split('_');
    if (parts.length < 2) return false;

    const week = parseInt(parts[1], 10);
    return week === targetWeek;
}

/**
 * Parse time label to Date object
 * Expected format: "Thu 8:50:03 PM", "Mon 12:15:00 AM", etc.
 */
function parseTimeLabel(timeLabel) {
    try {
        // Extract day abbreviation and time
        const parts = timeLabel.split(' ');
        if (parts.length < 3) return null;

        const dayAbbr = parts[0]; // "Thu", "Mon", etc.
        const time = parts[1]; // "8:50:03"
        const ampm = parts[2]; // "PM", "AM"

        // Map day abbreviations to day numbers (0 = Sunday)
        const dayMap = {
            'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3,
            'Thu': 4, 'Fri': 5, 'Sat': 6
        };

        const dayOfWeek = dayMap[dayAbbr];
        if (dayOfWeek === undefined) return null;

        // Parse time components
        const [hours, minutes, seconds] = time.split(':').map(Number);
        let adjustedHours = hours;

        // Convert to 24-hour format
        if (ampm === 'PM' && hours !== 12) adjustedHours += 12;
        if (ampm === 'AM' && hours === 12) adjustedHours = 0;

        // Create a date for this week (approximate)
        const now = new Date();
        const currentDay = now.getDay();
        const daysFromSunday = dayOfWeek;
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() - currentDay + daysFromSunday);
        targetDate.setHours(adjustedHours, minutes, seconds || 0, 0);

        return targetDate;
    } catch (error) {
        console.error(`Error parsing time label "${timeLabel}":`, error);
        return null;
    }
}

/**
 * Parse a time range string like "Mon 12:15 AM" into a comparable format
 */
function parseTimeRange(timeStr) {
    const parts = timeStr.split(' ');
    if (parts.length < 3) return null;

    const dayAbbr = parts[0];
    const time = parts[1];
    const ampm = parts[2];

    // Map day abbreviations to day numbers (0 = Sunday)
    const dayMap = {
        'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3,
        'Thu': 4, 'Fri': 5, 'Sat': 6
    };

    const dayOfWeek = dayMap[dayAbbr];
    if (dayOfWeek === undefined) return null;

    // Parse time components
    const [hours, minutes] = time.split(':').map(Number);
    let adjustedHours = hours;

    // Convert to 24-hour format
    if (ampm === 'PM' && hours !== 12) adjustedHours += 12;
    if (ampm === 'AM' && hours === 12) adjustedHours = 0;

    return {
        dayOfWeek,
        hours: adjustedHours,
        minutes
    };
}

/**
 * Check if a timestamp falls within the specified time range
 */
function isWithinTimeRange(timeLabel, startTimeStr, endTimeStr) {
    const parsedDate = parseTimeLabel(timeLabel);
    if (!parsedDate) return false;

    const startRange = parseTimeRange(startTimeStr);
    const endRange = parseTimeRange(endTimeStr);
    if (!startRange || !endRange) return false;

    const currentDay = parsedDate.getDay();
    const currentHours = parsedDate.getHours();
    const currentMinutes = parsedDate.getMinutes();

    // Convert everything to minutes since Sunday 00:00 for easier comparison
    const currentTotalMinutes = (currentDay * 24 * 60) + (currentHours * 60) + currentMinutes;
    const startTotalMinutes = (startRange.dayOfWeek * 24 * 60) + (startRange.hours * 60) + startRange.minutes;
    const endTotalMinutes = (endRange.dayOfWeek * 24 * 60) + (endRange.hours * 60) + endRange.minutes;

    // Handle case where end time might be in the next week (shouldn't happen but just in case)
    if (endTotalMinutes < startTotalMinutes) {
        // Range crosses week boundary
        return currentTotalMinutes >= startTotalMinutes || currentTotalMinutes <= endTotalMinutes;
    } else {
        // Normal range within the same week
        return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes <= endTotalMinutes;
    }
}

async function previewDataToDelete(targetWeek, startTime, endTime) {
    console.log(`🔍 PREVIEW MODE - Week ${targetWeek} Only`);
    console.log('==============================');
    console.log(`Deletion Range: ${startTime} through ${endTime}`);
    console.log(`Target: Documents matching pattern *_${targetWeek}_* (Week ${targetWeek} only)`);
    console.log('Will delete any data points timestamped within this range\n');

    try {
        const winProbCollection = collection(db, 'WinProbabilities');
        const snapshot = await getDocs(winProbCollection);

        // Filter to only target week documents
        const targetWeekDocs = snapshot.docs.filter(doc => isTargetWeekDocument(doc.id, targetWeek));

        console.log(`📊 Found ${snapshot.size} total documents`);
        console.log(`🎯 Filtered to ${targetWeekDocs.length} Week ${targetWeek} documents\n`);

        if (targetWeekDocs.length === 0) {
            console.log(`❌ No Week ${targetWeek} documents found!`);
            await cleanupAndExit(0);
            return;
        }

        let totalToRemove = 0;
        let docsWithProblems = 0;
        const allProblematicData = [];

        for (const docSnapshot of targetWeekDocs) {
            const docId = docSnapshot.id;
            const data = docSnapshot.data();

            console.log(`📋 Analyzing ${docId}...`);

            if (!data.points || !Array.isArray(data.points)) {
                console.log(`⚠️  ${docId}: No points array found, skipping\n`);
                continue;
            }

            // Find problematic points
            const problematicPoints = data.points.filter(point =>
                point.time && isWithinTimeRange(point.time, startTime, endTime)
            );

            if (problematicPoints.length > 0) {
                console.log(`🚨 ${docId} (${data.team1?.name || 'Team1'} vs ${data.team2?.name || 'Team2'}):`);
                console.log(`   📅 Season: ${data.season || 'N/A'}, Week: ${data.week || 'N/A'}`);
                console.log(`   📊 Total points: ${data.points.length}`);
                console.log(`   🗑️  Points to delete: ${problematicPoints.length}`);

                // Show first and last timestamps to be deleted
                const firstToDelete = problematicPoints[0];
                const lastToDelete = problematicPoints[problematicPoints.length - 1];

                const firstDate = parseTimeLabel(firstToDelete.time);
                const lastDate = parseTimeLabel(lastToDelete.time);
                const firstDay = firstDate ? firstDate.toLocaleDateString('en-US', { weekday: 'long' }) : 'Unknown';
                const lastDay = lastDate ? lastDate.toLocaleDateString('en-US', { weekday: 'long' }) : 'Unknown';

                console.log(`   🎯 First to delete: "${firstToDelete.time}" (${firstDay})`);
                console.log(`      Team1: ${(firstToDelete.team1Pct * 100).toFixed(1)}%, Team2: ${(firstToDelete.team2Pct * 100).toFixed(1)}%`);

                if (problematicPoints.length > 1) {
                    console.log(`   🎯 Last to delete: "${lastToDelete.time}" (${lastDay})`);
                    console.log(`      Team1: ${(lastToDelete.team1Pct * 100).toFixed(1)}%, Team2: ${(lastToDelete.team2Pct * 100).toFixed(1)}%`);
                }

                // Show what would remain
                const validPoints = data.points.filter(point =>
                    !point.time || !isWithinTimeRange(point.time, startTime, endTime)
                );

                if (validPoints.length > 0) {
                    const lastValidPoint = validPoints[validPoints.length - 1];
                    const validDate = parseTimeLabel(lastValidPoint.time);
                    const validDay = validDate ? validDate.toLocaleDateString('en-US', { weekday: 'long' }) : 'Unknown';
                    console.log(`   ✅ Last valid point kept: "${lastValidPoint.time}" (${validDay})`);
                } else {
                    console.log(`   ⚠️  No valid points would remain!`);
                }

                console.log(''); // Add spacing

                docsWithProblems++;
                totalToRemove += problematicPoints.length;

                allProblematicData.push({
                    docId,
                    matchup: `${data.team1?.name || 'Team1'} vs ${data.team2?.name || 'Team2'}`,
                    season: data.season,
                    week: data.week,
                    totalPoints: data.points.length,
                    pointsToDelete: problematicPoints.length,
                    firstToDelete: firstToDelete.time,
                    lastToDelete: lastToDelete.time
                });
            } else {
                console.log(`✅ ${docId}: Clean (${data.points.length} points, none in deletion range)`);
            }
        }

        console.log(`\n🎯 WEEK ${targetWeek} SUMMARY:`);
        console.log('==================');
        console.log(`📋 Week ${targetWeek} documents analyzed: ${targetWeekDocs.length}`);
        console.log(`🔧 Week ${targetWeek} documents to be modified: ${docsWithProblems}`);
        console.log(`🗑️  Total data points to delete: ${totalToRemove}`);
        console.log(`⏰ Deletion range: ${startTime} → ${endTime}`);

        if (docsWithProblems > 0) {
            console.log('\n📝 DETAILED BREAKDOWN:');
            console.log('======================');
            allProblematicData.forEach((doc, idx) => {
                console.log(`${idx + 1}. ${doc.matchup} (${doc.season}_${doc.week})`);
                console.log(`   Document ID: ${doc.docId}`);
                console.log(`   Deleting ${doc.pointsToDelete} of ${doc.totalPoints} points`);
                console.log(`   Deletion range: ${doc.firstToDelete} → ${doc.lastToDelete}`);
                console.log('');
            });

            console.log('🔥 TO EXECUTE THE ACTUAL DELETION:');
            console.log(`  1. Review the Week ${targetWeek} data above carefully`);
            console.log(`  2. If this looks correct, run:`);
            console.log(`     node cleanWinProbData.mjs --week=${targetWeek} --start="${startTime}" --end="${endTime}" --execute`);
            console.log('  3. This will permanently delete the data shown above');
        } else {
            console.log(`\n✅ Good news! No Week ${targetWeek} data found in the specified time range.`);
        }

        // Clean exit
        await cleanupAndExit(0);

    } catch (error) {
        console.error('❌ Error during preview:', error);
        await cleanupAndExit(1);
    }
}

async function executeCleanup(targetWeek, startTime, endTime) {
    console.log(`🔥 EXECUTING CLEANUP - Week ${targetWeek} Only`);
    console.log('===================================');
    console.log(`⚠️  This will permanently modify your Week ${targetWeek} Firestore data!`);
    console.log(`⏰ Deletion range: ${startTime} → ${endTime}\n`);

    try {
        const winProbCollection = collection(db, 'WinProbabilities');
        const snapshot = await getDocs(winProbCollection);

        // Filter to only target week documents
        const targetWeekDocs = snapshot.docs.filter(doc => isTargetWeekDocument(doc.id, targetWeek));

        console.log(`🎯 Processing ${targetWeekDocs.length} Week ${targetWeek} documents...\n`);

        let totalProcessed = 0;
        let totalCleaned = 0;
        let totalPointsRemoved = 0;

        for (const docSnapshot of targetWeekDocs) {
            const docId = docSnapshot.id;
            const data = docSnapshot.data();

            if (!data.points || !Array.isArray(data.points)) {
                continue;
            }

            const originalPointsCount = data.points.length;
            const cleanedPoints = data.points.filter(point => {
                if (!point.time) return true;
                return !isWithinTimeRange(point.time, startTime, endTime);
            });

            const removedCount = originalPointsCount - cleanedPoints.length;

            if (removedCount > 0) {
                console.log(`🔧 Cleaning ${docId}: Removing ${removedCount} points...`);

                const docRef = doc(db, 'WinProbabilities', docId);
                await updateDoc(docRef, {
                    points: cleanedPoints
                });

                totalCleaned++;
                totalPointsRemoved += removedCount;
                console.log(`   ✅ Updated successfully`);
            }

            totalProcessed++;
        }

        console.log(`\n📈 WEEK ${targetWeek} CLEANUP COMPLETED:`);
        console.log('============================');
        console.log(`📋 Week ${targetWeek} documents processed: ${totalProcessed}`);
        console.log(`🔧 Week ${targetWeek} documents modified: ${totalCleaned}`);
        console.log(`🗑️  Total data points deleted: ${totalPointsRemoved}`);
        console.log(`⏰ Time range cleaned: ${startTime} → ${endTime}`);
        console.log(`\n✅ Week ${targetWeek} cleanup successful!`);

        // Clean exit
        await cleanupAndExit(0);

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        await cleanupAndExit(1);
    }
}

// Handle process interruption (Ctrl+C)
process.on('SIGINT', async () => {
    console.log('\n⚠️  Script interrupted by user');
    await cleanupAndExit(130);
});

process.on('SIGTERM', async () => {
    console.log('\n⚠️  Script terminated');
    await cleanupAndExit(143);
});

// Main execution
const { week, startTime, endTime, shouldExecute } = parseArguments();

if (shouldExecute) {
    console.log(`⚠️  WARNING: You are about to permanently delete Week ${week} data!`);
    console.log(`⏰ Time range: ${startTime} → ${endTime}`);
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

    setTimeout(() => {
        executeCleanup(week, startTime, endTime);
    }, 5000);
} else {
    previewDataToDelete(week, startTime, endTime);
}