 require('dotenv').config();
 console.log("PASSPORT CLIENT:", process.env.GOOGLE_CLIENT_ID);

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/user');

passport.use(new GoogleStrategy({
  clientID:process.env.GOOGLE_CLIENT_ID,
  clientSecret:process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
},
async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;

    if (!email) {
      return done(new Error("No email found"), null);
    }

    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        email,
        password: "google_auth",
        googleId: profile.id
      });

      await user.save();
    }

    return done(null, user);

  } catch (error) {
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

module.exports = passport;