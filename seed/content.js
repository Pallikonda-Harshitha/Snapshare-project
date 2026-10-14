// Demo accounts, posts and comments.
// Used by `npm run seed` (through the API) and by the server, which adds them
// automatically when the site has no public posts yet (see src/lib/demo.js).

// Sample accounts. These are for local demos only; delete them from your data when you are done.
const PASSWORD = 'snapshare-demo-1';
const USERS = [
  { key: 'arjun', name: 'Arjun Mehta', email: 'arjun@snapshare.demo' },
  { key: 'priya', name: 'Priya Sharma', email: 'priya@snapshare.demo' },
];

// One entry is one post. `files` are its photos, the first is the cover.
// `replaces` lists older single-photo demo posts that this post supersedes;
// they are removed first so the same picture is not shown twice.
const POSTS = [
  { by: 'arjun', title: 'Himalayan Peaks', category: 'Travel', tags: 'travel, mountains, snow', files: ['photo-29.jpg'],
    description: 'Fresh snow on the ridgeline after a cold, clear morning. The valley below was still in shadow.' },
  { by: 'arjun', title: 'Waterfall Hike', category: 'Nature', tags: 'nature, waterfall, hiking', files: ['photo-15.jpg', 'photo-28.jpg', 'photo-10.jpg'],
    replaces: ['Hidden Waterfall', 'Green Gorge', 'Forest Above the Bay'],
    description: 'A full day on the trail: the falls, the green gorge below them and the view back over the bay.' },
  { by: 'arjun', title: 'Trail Days', category: 'People', tags: 'people, hiking, sunset', files: ['photo-177.jpg', 'photo-173.jpg'],
    replaces: ['Trail Day', 'Sunset Silhouette'],
    description: 'Pausing on the ridge, then one figure and a lot of sky as the light went.' },
  { by: 'arjun', title: 'Workspace Setups', category: 'Technology', tags: 'tech, workspace, laptop', files: ['photo-48.jpg', 'photo-180.jpg', 'photo-201.jpg', 'photo-119.jpg'],
    replaces: ['Work From Anywhere', 'Desk Setup', 'Clean Workspace', 'Gadgets on White'],
    description: 'Four desks, four moods. Laptop, notebook and a plan for the week.' },
  { by: 'arjun', title: 'Vintage Car Meet', category: 'Events', tags: 'events, cars, vintage', files: ['photo-133.jpg', 'photo-111.jpg', 'photo-183.jpg'],
    replaces: ['Classic Car Meet', 'Show Car', 'Campervan Gathering'],
    description: 'The weekend meet: polished chrome, a very patient owner and a campervan with a story.' },
  { by: 'arjun', title: 'Old Stone', category: 'Architecture', tags: 'architecture, heritage, travel', files: ['photo-142.jpg', 'photo-193.jpg'],
    replaces: ['Chateau at the End of the Road', 'College Lawn'],
    description: 'A chateau at the end of the drive and a college lawn with four hundred years of stonework.' },
  { by: 'arjun', title: 'Time', category: 'Other', tags: 'monochrome, clock, abstract', files: ['photo-175.jpg'],
    description: 'A black and white study of a station clock.' },

  { by: 'priya', title: 'Pet Diaries', category: 'Animals', tags: 'pets, dog, cat', files: ['photo-237.jpg', 'photo-1025.jpg', 'photo-40.jpg'],
    replaces: ['Puppy Eyes', 'Cozy Pug', 'Whiskers Up Close'],
    description: 'A puppy who knows exactly how to get a treat, a pug in a blanket and a very sleepy cat.' },
  { by: 'priya', title: 'Cafe Mornings', category: 'Food', tags: 'food, coffee, cafe', files: ['photo-42.jpg', 'photo-113.jpg', 'photo-102.jpg'],
    replaces: ['Morning Coffee', 'Warm Cup', 'Fresh Raspberries'],
    description: 'Espresso before the rush, something warm in a cup, and raspberries that did not last the afternoon.' },
  { by: 'priya', title: 'Steel and Concrete', category: 'Architecture', tags: 'architecture, bridge, city', files: ['photo-134.jpg', 'photo-101.jpg'],
    replaces: ['Iron Arches', 'Concrete and Sky'],
    description: 'Looking straight up at old ironwork, then hard lines against a soft sky.' },
  { by: 'priya', title: 'Golden Hour Portraits', category: 'People', tags: 'people, portrait, sunset', files: ['photo-64.jpg', 'photo-129.jpg'],
    replaces: ['Golden Hour Portrait', 'Two on a Bench'],
    description: 'Wildflowers and warm light, then the best seat on the beach.' },
  { by: 'priya', title: 'Coastal Escape', category: 'Travel', tags: 'travel, beach, trail', files: ['photo-12.jpg', 'photo-17.jpg'],
    replaces: ['Quiet Shoreline', 'Path to the Coast'],
    description: 'Low tide and soft light, then the orchard trail that led straight to the sea.' },
  { by: 'priya', title: 'Weathered Planks', category: 'Other', tags: 'texture, wood, abstract', files: ['photo-143.jpg'],
    description: 'Old boards, peeling paint and a lot of character.' },
  { by: 'priya', title: 'Tunnel of Light', category: 'Other', tags: 'abstract, light, tunnel', files: ['photo-137.jpg'],
    description: 'Looking up a shaft to a pinpoint of daylight.' },
];

const COMMENTS = [
  ['priya', 'Himalayan Peaks', 'Absolutely stunning. The light on the ridge is perfect.'],
  ['arjun', 'Himalayan Peaks', 'Thank you! Took this one just after sunrise.'],
  ['arjun', 'Pet Diaries', 'The pug in the blanket is the best photo on the site.'],
  ['priya', 'Waterfall Hike', 'Where is this? I want to go.'],
  ['arjun', 'Cafe Mornings', 'Now I want a coffee.'],
  ['priya', 'Vintage Car Meet', 'That chrome is unreal.'],
];

module.exports = { PASSWORD, USERS, POSTS, COMMENTS };
