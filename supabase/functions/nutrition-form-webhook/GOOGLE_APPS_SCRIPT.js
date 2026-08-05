// ============================================================
// Google Apps Script — paste this into your Google Form's Script Editor
//
// Steps:
// 1. Open the Google Form in edit mode
// 2. Click the three dots (⋮) → Script editor
// 3. Replace the default code with this script
// 4. Click "Save" then go to Triggers (clock icon on left)
// 5. Add trigger: onFormSubmit → From form → On form submit
// 6. Authorize the script when prompted
// ============================================================

var WEBHOOK_URL = 'https://lvizldmdficsfpgegehp.supabase.co/functions/v1/nutrition-form-webhook';
var WEBHOOK_SECRET = 'reshape-nutrition-2026';

function onFormSubmit(e) {
  var responses = e.response.getItemResponses();
  var data = { secret: WEBHOOK_SECRET };

  // Map each question title to a field name
  var fieldMap = {
    'Email Address': 'email',
    'Full Name': 'full_name',
    'Date of Birth': 'date_of_birth',
    'Phone Number': 'phone',
    'Emergency Contact Name': 'emergency_contact_name',
    'Emergency Contact Number': 'emergency_contact_number',
    'Current dress/trouser size': 'current_size',
    'Next goal': 'next_goal',
    'motivation': 'motivation',
    'why': 'motivation',
    'Target achievement date': 'target_date',
    'breakfast': 'breakfast',
    'lunch': 'lunch',
    'dinner': 'dinner',
    'Snacking habits': 'snacking',
    'snacking': 'snacking',
    'Tea/coffee consumption': 'tea_coffee',
    'tea': 'tea_coffee',
    'coffee': 'tea_coffee',
    'Food weaknesses': 'food_weaknesses',
    'Diet preference': 'diet_preference',
    'diet': 'diet_preference',
    'Past diet': 'past_diets',
    'Eating out frequency': 'eating_out_frequency',
    'eating out': 'eating_out_frequency',
    'choices when eating out': 'eating_out_choices',
    'Alcohol': 'alcohol',
    'alcohol consumption': 'alcohol',
    'Takeaway': 'takeaways',
    'takeaway habits': 'takeaways',
    'Meals per day': 'meals_per_day',
    'meals a day': 'meals_per_day',
    'Maximum daily meals': 'max_daily_meals',
    'maximum': 'max_daily_meals',
    'Cooking frequency': 'cooking_frequency',
    'cook': 'cooking_frequency',
    'Meal types': 'meal_types',
    'meal type': 'meal_types',
    'Dietary challenges': 'dietary_challenges',
    'challenges': 'dietary_challenges',
    'Training time': 'training_time',
    'train': 'training_time',
    'Step tracking device': 'step_tracker',
    'step track': 'step_tracker',
    'Daily steps': 'daily_steps',
    'steps': 'daily_steps',
    'Family/partner support': 'family_support',
    'family': 'family_support',
    'partner': 'family_support',
    'Smoking': 'smoking',
    'smoke': 'smoking',
    'Bowel movements': 'bowel_per_week',
    'bowel': 'bowel_per_week',
    'Bowel movement quality': 'bowel_quality',
    'Sleepiness after': 'sleepy_after_carbs',
    'sleepy': 'sleepy_after_carbs',
    'Sleep difficulty': 'sleep_difficulty',
    'difficulty getting to sleep': 'sleep_difficulty',
    'Sleep environment': 'sleep_disturbances',
    'disturbance': 'sleep_disturbances',
    'Average sleep hours': 'sleep_hours',
    'sleep hours': 'sleep_hours',
    'hours of sleep': 'sleep_hours',
    'Nighttime awakenings': 'night_awakenings',
    'wake up': 'night_awakenings',
    'Morning wake difficulty': 'wake_difficulty',
    'getting up in the morning': 'wake_difficulty',
    'Alarm dependency': 'alarm_dependency',
    'alarm': 'alarm_dependency',
    'Morning fatigue': 'morning_fatigue',
    'fatigue': 'morning_fatigue',
    'Headache': 'headache_frequency',
    'headache': 'headache_frequency',
    'Stress response': 'stress_response',
    'stress easily': 'stress_response',
    'Stress management': 'stress_management',
    'manage stress': 'stress_management',
    'Depression': 'depression',
    'low mood': 'depression',
    'Mental health rating': 'mental_health_rating',
    'mental health': 'mental_health_rating',
    'Concentration': 'concentration',
    'concentrate': 'concentration',
    'Anxiety': 'anxiety',
    'anxious': 'anxiety',
    'Supplement': 'supplements',
    'supplement': 'supplements',
    'Sex drive': 'sex_drive',
    'libido': 'sex_drive',
    'Sugar cravings': 'sugar_cravings',
    'sugar': 'sugar_cravings',
    'Energy levels': 'energy_levels',
    'energy': 'energy_levels',
    'Medications': 'medications',
    'medication': 'medications',
    'Injuries': 'injuries',
    'injury': 'injuries',
    'Heart condition': 'heart_condition',
    'heart': 'heart_condition',
    'Chest pain': 'chest_pain',
    'chest': 'chest_pain',
    'Diabetes': 'diabetes',
    'diabetic': 'diabetes',
    'Epilepsy': 'epilepsy',
    'epilep': 'epilepsy',
    'Asthma': 'asthma',
    'Musculoskeletal': 'musculoskeletal',
    'bone': 'musculoskeletal',
    'joint': 'musculoskeletal',
    'Blood pressure': 'bp_medication',
    'blood': 'bp_medication',
    'Dizziness': 'dizziness',
    'dizzy': 'dizziness',
    'faint': 'dizziness',
    'Growth plate': 'growth_hypermobility',
    'hypermobility': 'growth_hypermobility',
    'contraindication': 'exercise_contraindications',
    'Exercise limitation': 'exercise_limitations',
    'limitation': 'exercise_limitations',
    'Obstacle': 'obstacles',
    'obstacle': 'obstacles',
    'Additional information': 'additional_info',
    'additional': 'additional_info',
    'anything else': 'additional_info',
    'Allergies': 'allergies_acknowledged',
    'allerg': 'allergies_acknowledged',
    'Liability': 'liability_agreed',
    'liab': 'liability_agreed',
    'disclaimer': 'liability_agreed',
  };

  for (var i = 0; i < responses.length; i++) {
    var title = responses[i].getItem().getTitle();
    var value = responses[i].getResponse();
    var field = matchField(title, fieldMap);
    if (field) {
      data[field] = value;
    }
  }

  // Also capture the respondent email if collected
  var email = e.response.getRespondentEmail();
  if (email) data.email = email;

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(data),
    muteHttpExceptions: true,
  };

  try {
    var res = UrlFetchApp.fetch(WEBHOOK_URL, options);
    Logger.log('Webhook response: ' + res.getResponseCode() + ' ' + res.getContentText());
  } catch (err) {
    Logger.log('Webhook error: ' + err);
  }
}

// Fuzzy match question title to field name
function matchField(title, fieldMap) {
  var lower = title.toLowerCase().trim();

  // Exact match first
  if (fieldMap[title]) return fieldMap[title];

  // Case-insensitive match
  for (var key in fieldMap) {
    if (lower === key.toLowerCase()) return fieldMap[key];
  }

  // Partial match — check if any key is contained in the title
  for (var key in fieldMap) {
    if (lower.indexOf(key.toLowerCase()) >= 0) return fieldMap[key];
  }

  return null;
}
