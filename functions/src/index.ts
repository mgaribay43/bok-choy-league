// firebase cloud functions
//
// deploy all functions
// firebase deploy --only functions
//
// if you only want to deploy one
// firebase deploy --only functions:FUNCTION_NAME

export { getTeams } from './getTeams';
export { yahooOAuth } from './yahooOAuth';
