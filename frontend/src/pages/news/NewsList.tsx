import { Link } from 'react-router-dom';
import newsData from '../../data/news.json';

export const NewsList = () => {
    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="bg-sffl-navy text-white p-8 rounded-2xl shadow-xl">
                <h1 className="text-5xl font-black italic">LEAGUE NEWS</h1>
                <p className="text-gray-300 mt-2 text-lg">Latest updates from the SFFL</p>
            </div>

            {/* News Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {newsData.map((article) => (
                    <Link
                        key={article.id}
                        to={`/news/${article.slug}`}
                        className="group bg-white rounded-xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
                    >
                        {/* Featured Image */}
                        <div className="h-48 overflow-hidden bg-gray-200">
                            <img
                                src={article.featuredImage}
                                alt={article.title}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            {/* Category Badge */}
                            <div className="inline-block bg-sffl-red text-white text-xs font-bold px-3 py-1 rounded-full mb-3 uppercase">
                                {article.category}
                            </div>

                            {/* Title */}
                            <h2 className="font-black text-xl text-sffl-navy mb-2 group-hover:text-sffl-red transition-colors line-clamp-2">
                                {article.title}
                            </h2>

                            {/* Excerpt */}
                            <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                                {article.excerpt}
                            </p>

                            {/* Meta */}
                            <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>{article.author}</span>
                                <span>{new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
};
