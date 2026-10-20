-- +goose Up

-- FAQs used to be hard-coded in four page components. They live here now so an
-- admin can edit them without a deploy. A "page" is a place on the site that shows
-- FAQs (keyed by a short slug the front end asks for); it may group its questions
-- into categories (the FAQ page does) or just list them (Game Pass does).
CREATE TABLE IF NOT EXISTS faq_pages (
    key VARCHAR(60) PRIMARY KEY CHECK (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    name VARCHAR(120) NOT NULL,
    -- Where on the site these FAQs appear, shown to the admin as a hint. Not used for routing.
    path VARCHAR(200) NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS faq_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_key VARCHAR(60) NOT NULL REFERENCES faq_pages(key) ON DELETE CASCADE,
    -- Stable, URL-safe handle (the FAQ page links to ?category=<slug>). Set once, never edited.
    slug VARCHAR(80) NOT NULL,
    title VARCHAR(120) NOT NULL,
    -- Name of an icon the front end knows (football, ticket, handshake, rocket, pitch). Empty = none.
    icon VARCHAR(30) NOT NULL DEFAULT '',
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (page_key, slug)
);

CREATE TABLE IF NOT EXISTS faq_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_key VARCHAR(60) NOT NULL REFERENCES faq_pages(key) ON DELETE CASCADE,
    -- NULL for pages that don't group their questions.
    category_id UUID REFERENCES faq_categories(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    -- Plain text or sanitized rich-text HTML (same rule as other admin text fields).
    answer TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faq_categories_page ON faq_categories (page_key, display_order);
CREATE INDEX IF NOT EXISTS idx_faq_items_page ON faq_items (page_key, category_id, display_order);

-- Seed with exactly what the pages showed, so nothing changes on deploy.
INSERT INTO faq_pages (key, name, path, description) VALUES
    ('faq',         'FAQ page',    '/about/faq',            'The full help centre, grouped into categories.'),
    ('about',       'About page',  '/about/showtime-flag',  'The short list under "Frequently asked questions" on the About page.'),
    ('game-pass',   'Game Pass',   '/tickets/game-pass',    'The "How a Game Pass works" list.'),
    ('season-pass', 'Season Pass', '/tickets/season-pass',  'The "How a Season Pass works" list.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO faq_categories (page_key, slug, title, icon, display_order) VALUES
    ('faq', 'about-sffl', 'About Showtime Flag Football', 'football', 0),
    ('faq', 'games-attendance', 'Games & Attendance', 'ticket', 1),
    ('faq', 'sponsorships', 'Sponsorships & Partnerships', 'handshake', 2),
    ('faq', 'incubator', 'Players & Development (Incubator)', 'rocket', 3),
    ('faq', 'own-a-team', 'Own A Team', 'pitch', 4)
ON CONFLICT (page_key, slug) DO NOTHING;

INSERT INTO faq_items (page_key, category_id, question, answer, display_order) VALUES
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'about-sffl'), 'What is flag football?', 'Flag football is a non-contact version of American football where tackles are replaced by the removal of a flag attached to the ball carrier. The game is fast-paced, strategic, and highly competitive.', 0),
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'about-sffl'), 'Is Showtime co-ed?', 'Yes. Showtime is structured as a co-ed league, with men and women competing together at the highest level.', 1),
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'about-sffl'), 'How many teams compete in Showtime each season?', 'The number of teams may vary by season. Each team qualifies based on league requirements and operates within the official competitive structure established by Showtime.', 2),
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'about-sffl'), 'How long is a Showtime season?', 'A Showtime season runs across thirteen Sundays, culminating in playoffs and a championship finale.', 3),
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'about-sffl'), 'How competitive is the league?', 'Showtime operates at an elite and professional level. Teams compete within structured rankings, and performance standards are enforced throughout the season.', 4),
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'about-sffl'), 'Are referees and officials certified?', 'Yes. Showtime games are governed by qualified officials who uphold league integrity and enforce standardized rules of play.', 5),
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'about-sffl'), 'How are champions determined?', 'Champions are determined through structured playoff systems based on season rankings and performance outcomes leading to the Showtime Bowl.', 6),
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'about-sffl'), 'What makes Showtime different from other flag football competitions?', 'Showtime combines elite co-ed competition with curated spectacle. We are structured, performance-driven, and intentionally staged defining the highest standard in the format.', 7),
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'games-attendance'), 'When and where are games held?', 'Games are held every Sunday during the season at Showtime Arena, Lekki.', 0),
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'games-attendance'), 'How can I attend?', 'Tickets can be purchased online before game day. Availability may be limited based on capacity.', 1),
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'games-attendance'), 'Is Showtime suitable for first-time sports viewers?', 'Yes. Whether you’re a longtime sports fan or new to flag football, the game-day experience is designed to be immersive, engaging, and easy to follow.', 2),
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'games-attendance'), 'Are there food and beverage options at games?', 'Yes. Showtime game days feature curated food, drink, and lounge experiences designed to enhance the overall atmosphere.', 3),
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'games-attendance'), 'Is Showtime family-friendly?', 'Yes. Showtime is inclusive and welcoming to a wide range of audiences, while maintaining a high-energy competitive atmosphere.', 4),
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'games-attendance'), 'How can I stay updated on the season schedule?', 'Season schedules, match fixtures, and league updates are released on our official digital platforms and website.', 5),
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'sponsorships'), 'How can my brand partner with Showtime?', 'Organizations interested in sponsorship and partnership opportunities can contact our team to receive a sponsorship proposal and partnership deck.', 0),
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'sponsorships'), 'Can businesses host corporate outings at Showtime?', 'Yes. Corporate hospitality packages and group bookings are available for brands and organizations seeking premium group experiences.', 1),
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'sponsorships'), 'Is there media coverage of Showtime games?', 'Yes. Games are documented through digital media, live coverage, and post-game content distributed across official platforms.', 2),
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'sponsorships'), 'Does Showtime collaborate with other cities or regions?', 'Showtime is designed to be scalable and open to strategic collaborations that align with our institutional standards.', 3),
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'incubator'), 'How do I join the Showtime Incubator?', 'Athletes join the Showtime Incubator through our development pipeline. Players are identified through initiatives such as Showtime Streetz, where we scout raw talent across different parts of the country, or through participation in Showtime Pro, our intensive training program. Athletes may be scouted directly from Showtime Streets or enroll in Showtime Pro training. Following evaluation and performance assessment, selected athletes are added to one of the Incubator teams.', 0),
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'incubator'), 'What is Showtime Streetz?', 'Showtime Streetz is our scouting initiative. Through this program, we visit different parts of the country to identify and recruit raw athletic talent with the potential to compete at the highest level.', 1),
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'incubator'), 'What is Showtime Pro?', 'Showtime Pro is our intensive training and development program designed to elevate athletes through structured coaching, performance evaluation, and competitive preparation. Even athletes who are not scouted through Showtime Streetz can join Showtime Pro. Outstanding performers may be selected to join the Incubator teams.', 2),
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'incubator'), 'Does Showtime support youth or grassroots development?', 'Yes. Through initiatives like the Showtime Streetz and Showtime Incubator program, we invest in structured development pathways for emerging talent.', 3),
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'incubator'), 'Can players transfer between teams?', 'Player eligibility, transfers, and roster management are governed by official league regulations to ensure competitive balance.', 4),
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'own-a-team'), 'How can I own a team in Showtime Flag Football?', 'We welcome passionate individuals and organisations who want to be part of the Showtime franchise. Team ownership opportunities are available on a case-by-case basis and are subject to league approval. To express your interest or get more information, please reach out to us directly at showtime@sffl.football and a member of our team will get back to you.', 0),
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'own-a-team'), 'What does owning a team involve?', 'Team owners are responsible for managing their franchise within the Showtime framework — including player recruitment, team operations, and upholding league standards. Full guidance is provided upon approval. Contact us at showtime@sffl.football to start the conversation.', 1),
    ('faq', (SELECT id FROM faq_categories WHERE page_key = 'faq' AND slug = 'own-a-team'), 'Is there a cost to owning a team?', 'Ownership structures vary and are discussed directly with prospective owners. For detailed information on fees, obligations, and benefits, contact our team at showtime@sffl.football.', 2);

INSERT INTO faq_items (page_key, question, answer, display_order) VALUES
    ('about', 'What is flag football?', 'Flag football is a non-contact version of American football where tackles are replaced by the removal of a flag attached to the ball carrier. The game is fast-paced, strategic, and highly competitive.', 0),
    ('about', 'Is Showtime co-ed?', 'Yes. Showtime is structured as a co-ed league, with men and women competing together at the highest level.', 1),
    ('about', 'When and where are games held?', 'Games are held every Sunday during the season at Showtime Arena, Lekki.', 2);

INSERT INTO faq_items (page_key, question, answer, display_order) VALUES
    ('game-pass', 'What is a Game Pass?', 'One pass that covers the match days you choose, from one to as many as you like. You pay once and get one code that works on each of them.', 0),
    ('game-pass', 'Why buy more than one match day?', 'The more match days on your pass, the bigger the discount. The savings are shown above the tickets and on your total.', 1),
    ('game-pass', 'Can I pick any days?', 'Yes. Any combination of match days that are on sale, from today onwards. They don''t need to be back to back.', 2),
    ('game-pass', 'What are the names in brackets?', 'The tournament each match day belongs to, for example (Regular Season) before the game day. Filter by tournament to see only its match days.', 3),
    ('game-pass', 'How do I get in?', 'Show your code at the entrance on each match day. You will also get an email reminder the day before each one.', 4),
    ('game-pass', 'What if one of the days sells out?', 'A sold-out day can''t be added. Pick the days that are still open.', 5);

INSERT INTO faq_items (page_key, question, answer, display_order) VALUES
    ('season-pass', 'What is a Season Pass?', 'One pass, one price, valid every match day until its end date. No need to pick days — just show your code at the gate whenever you come.', 0),
    ('season-pass', 'How is this different from a Game Pass?', 'A Game Pass covers the specific match days you choose. A Season Pass covers every match day up to its end date, for one flat price.', 1),
    ('season-pass', 'Can I use it more than once a day?', 'Yes. Being scanned in twice on the same day is never a problem.', 2),
    ('season-pass', 'What happens after the end date?', 'The pass stops working. Check the end date on each pass before buying.', 3);

-- The FAQs admin page (feature "faqs"), given to the roles that already edit the other
-- public content. app_admin has everything regardless.
-- Selected from roles so a role deleted since migration 115 doesn't break this.
INSERT INTO role_permissions (role_key, feature, level)
SELECT key, 'faqs', 'full' FROM roles WHERE key IN ('admin', 'content_creator')
ON CONFLICT (role_key, feature) DO NOTHING;

-- +goose Down

DELETE FROM role_permissions WHERE feature = 'faqs';
DROP TABLE IF EXISTS faq_items;
DROP TABLE IF EXISTS faq_categories;
DROP TABLE IF EXISTS faq_pages;
