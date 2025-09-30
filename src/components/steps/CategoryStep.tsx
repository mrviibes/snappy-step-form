import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ArrowLeft, MoreVertical, Trash2, Edit, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fitnessGoals, ThemeItem, SubcategoryItem } from "@/data/CategoryList";

interface CategoryStepProps {
  data: any;
  updateData: (data: any) => void;
  onNext: () => void;
}

export default function CategoryStep({
  data,
  updateData,
  onNext
}: CategoryStepProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [subcategorySearchQuery, setSubcategorySearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [showingSubcategories, setShowingSubcategories] = useState(false);
  const [currentInput, setCurrentInput] = useState("");
  const [specificItems, setSpecificItems] = useState<string[]>([]);

  // Create flattened search results for direct theme/subcategory selection
  const getSearchResults = () => {
    if (!searchQuery || searchQuery.length === 0) return [];
    
    const searchLower = searchQuery.toLowerCase();
    const results: Array<{
      categoryId: string;
      categoryTitle: string;
      subcategoryId: string;
      subcategoryTitle: string;
      themeId?: string;
      themeTitle?: string;
      categoryColor: string;
      matchType: 'theme' | 'subcategory';
      relevance: number;
    }> = [];

    fitnessGoals.forEach(goal => {
      (goal.subcategories as SubcategoryItem[]).forEach((subcategory: SubcategoryItem) => {
        // Check themes for matches
        if (subcategory.themes) {
          subcategory.themes.forEach((theme: ThemeItem) => {
            const themeLower = theme.title.toLowerCase();
            const exactMatch = themeLower === searchLower;
            const startsWithMatch = themeLower.startsWith(searchLower);
            const includesMatch = themeLower.includes(searchLower);
            
            if (exactMatch || startsWithMatch || includesMatch) {
              results.push({
                categoryId: goal.id,
                categoryTitle: goal.title,
                subcategoryId: subcategory.id,
                subcategoryTitle: subcategory.title,
                themeId: theme.id,
                themeTitle: theme.title,
                categoryColor: getCategoryColor(goal.title),
                matchType: 'theme',
                relevance: exactMatch ? 3 : startsWithMatch ? 2 : 1
              });
            }
          });
        }
        
        // Also check subcategories for matches
        const subcategoryLower = subcategory.title.toLowerCase();
        const matches = subcategoryLower.includes(searchLower) ||
                       subcategoryLower.split(' ').some((word: string) => word.startsWith(searchLower)) ||
                       subcategoryLower.replace('-', ' ').includes(searchLower);
        
        if (matches) {
          results.push({
            categoryId: goal.id,
            categoryTitle: goal.title,
            subcategoryId: subcategory.id,
            subcategoryTitle: subcategory.title,
            categoryColor: getCategoryColor(goal.title),
            matchType: 'subcategory',
            relevance: subcategoryLower === searchLower ? 3 : subcategoryLower.startsWith(searchLower) ? 2 : 1
          });
        }
      });
    });

    // Sort by relevance (exact theme matches first, then subcategory matches)
    return results.sort((a, b) => {
      // Prioritize theme matches over subcategory matches
      if (a.matchType === 'theme' && b.matchType === 'subcategory') return -1;
      if (a.matchType === 'subcategory' && b.matchType === 'theme') return 1;
      // Then sort by relevance score
      if (a.relevance !== b.relevance) return b.relevance - a.relevance;
      // Finally sort alphabetically
      const aTitle = a.themeTitle || a.subcategoryTitle;
      const bTitle = b.themeTitle || b.subcategoryTitle;
      return aTitle.localeCompare(bTitle);
    });
  };

  // Get category color for badges
  const getCategoryColor = (categoryTitle: string) => {
    const colors = {
      'Celebrations': 'bg-pink-500',
      'Daily Life': 'bg-blue-500', 
      'Sports': 'bg-green-500',
      'Pop Culture': 'bg-purple-500',
      'Jokes': 'bg-orange-500',
      'Miscellaneous': 'bg-cyan-500'
    };
    return colors[categoryTitle as keyof typeof colors] || 'bg-gray-500';
  };

  const searchResults = getSearchResults();

  // Handle direct theme selection from search results
  const handleDirectThemeSelection = (categoryId: string, subcategoryId: string, themeTitle?: string) => {
    // For Pop Culture - pre-fill specific item input
    if (categoryId === "pop-culture" && themeTitle) {
      const subcategoriesRequiringSpecificItem = ["movies", "tv-shows", "celebrities", "music", "anime", "fictional-characters"];
      if (subcategoriesRequiringSpecificItem.includes(subcategoryId)) {
        const newItems = [themeTitle];
        setSpecificItems(newItems);
        updateData({
          category: categoryId,
          subcategory: subcategoryId,
          specificItems: newItems,
          specificItem: newItems.join(', ')
        });
        return;
      }
    }
    
    // For all other categories - complete selection
    updateData({
      category: categoryId,
      subcategory: subcategoryId
    });
  };

  // Handle direct subcategory selection from search results (no theme)
  const handleDirectSubcategorySelection = (categoryId: string, subcategoryId: string) => {
    // Check if this is Pop Culture and requires specific item input
    if (categoryId === "pop-culture") {
      const subcategoriesRequiringSpecificItem = ["movies", "tv-shows", "celebrities", "music", "anime", "fictional-characters"];
      if (subcategoriesRequiringSpecificItem.includes(subcategoryId)) {
        // Set category and subcategory but don't proceed - wait for specific item input
        updateData({
          category: categoryId,
          subcategory: subcategoryId,
          specificItem: "",
          specificItems: []
        });
        setSpecificItems([]);
        return;
      }
    }
    
    updateData({
      category: categoryId,
      subcategory: subcategoryId
    });
  };

  const filteredGoals = searchQuery.length === 0 ? fitnessGoals : [];
  const selectedCategoryData = selectedCategory ? fitnessGoals.find(goal => goal.id === selectedCategory) : null;
  const selectedSubcategoryData = selectedSubcategory && selectedCategoryData 
    ? (selectedCategoryData.subcategories as SubcategoryItem[]).find((sub: SubcategoryItem) => sub.id === selectedSubcategory) 
    : null;
  const filteredSubcategories = selectedCategoryData ? (selectedCategoryData.subcategories as SubcategoryItem[]).filter((subcategory: SubcategoryItem) => subcategory.title.toLowerCase().includes(subcategorySearchQuery.toLowerCase())) : [];
  
  const handleCategorySelection = (goalId: string) => {
    setSelectedCategory(goalId);
    setShowingSubcategories(true);
    setSearchQuery("");
    setSubcategorySearchQuery("");
  };
  
  const handleSubcategorySelection = (subcategoryId: string) => {
    const categoryData = fitnessGoals.find(goal => goal.id === selectedCategory);
    
    // Check if this is Pop Culture and requires specific item input
    if (selectedCategory === "pop-culture") {
      const subcategoriesRequiringSpecificItem = ["movies", "tv-shows", "celebrities", "music", "anime", "fictional-characters"];
      if (subcategoriesRequiringSpecificItem.includes(subcategoryId)) {
        // Set subcategory but don't proceed - wait for specific item input
        updateData({
          category: selectedCategory,
          subcategory: subcategoryId,
          specificItem: "",
          specificItems: []
        });
        setSpecificItems([]);
        return;
      }
    }
    
    updateData({
      category: selectedCategory,
      subcategory: subcategoryId
    });
  };
  
  const handleEditCategory = () => {
    setShowingSubcategories(false);
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setSearchQuery("");
    setSubcategorySearchQuery("");
    updateData({
      category: "",
      subcategory: "",
      specificItem: "",
      specificItems: []
    });
    setSpecificItems([]);
    setCurrentInput("");
  };
  
  const handleEditSubcategory = () => {
    updateData({
      subcategory: "",
      specificItem: "",
      specificItems: []
    });
    setSpecificItems([]);
    setCurrentInput("");
  };
  
  const handleBack = () => {
    setShowingSubcategories(false);
    setSelectedCategory(null);
    setSearchQuery("");
    setSubcategorySearchQuery("");
  };

  // Handle adding items as tags
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && currentInput.trim()) {
      e.preventDefault();
      const newItem = currentInput.trim();
      console.log('Adding movie:', newItem); // Debug log
      if (!specificItems.includes(newItem)) {
        const newItems = [...specificItems, newItem];
        setSpecificItems(newItems);
        updateData({ 
          category: data.category,
          subcategory: data.subcategory,
          specificItems: newItems,
          specificItem: newItems.length > 0 ? newItems.join(', ') : ''
        });
        console.log('Updated data with items:', newItems); // Debug log
      }
      setCurrentInput('');
    }
  };

  // Handle removing a tag
  const handleRemoveItem = (itemToRemove: string) => {
    const newItems = specificItems.filter(item => item !== itemToRemove);
    setSpecificItems(newItems);
    updateData({ 
      specificItems: newItems,
      specificItem: newItems.length > 0 ? newItems.join(', ') : ''
    });
  };

  // If category and subcategory are selected, show compact view
  if (data.category && data.subcategory) {
    const categoryData = fitnessGoals.find(goal => goal.id === data.category);
    const subcategoryData = (categoryData?.subcategories as SubcategoryItem[])?.find(sub => sub.id === data.subcategory);
    
    return (
      <>
        <div className="rounded-xl border-2 border-cyan-400 bg-card overflow-hidden">
          {/* Selected Category */}
          <div className="flex items-center justify-between p-4">
            <div className="text-sm text-foreground">
              <span className="font-bold text-muted-foreground">Category</span> - <span className="font-normal">{categoryData?.title}</span>
            </div>
            <button onClick={handleEditCategory} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">
              Edit
            </button>
          </div>

          {/* Specific Items Display for Pop Culture */}
          {data.category === "pop-culture" && specificItems.length > 0 && (
            <div className="flex items-start justify-between p-4 border-t border-border">
              <div className="flex-1">
                <div className="text-sm text-muted-foreground font-bold mb-2">
                  Specific {subcategoryData?.title || 'Items'}:
                </div>
                <div className="flex flex-wrap gap-2">
                  {specificItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-1 bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200 px-2 py-1 rounded-full text-xs">
                      {item}
                      <button 
                        onClick={() => handleRemoveItem(item)}
                        className="hover:text-cyan-600 dark:hover:text-cyan-400"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <button 
                onClick={() => {
                  setSpecificItems([]);
                  updateData({ specificItem: "", specificItems: [] });
                  setCurrentInput("");
                }} 
                className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors"
              >
                Edit
              </button>
            </div>
          )}

        </div>

        {/* Specific Item Input for Pop Culture subcategories */}
        {data.category === "pop-culture" && data.subcategory && specificItems.length === 0 &&
         ["movies", "tv-shows", "celebrities", "music", "anime", "fictional-characters"].includes(data.subcategory) && (
          <div className="mt-8 space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-medium text-foreground mb-2">
                Is there a certain "{subcategoryData?.title?.slice(0, -1) || 'item'}" you want?
              </h3>
              <p className="text-sm text-muted-foreground">
                Enter specific {subcategoryData?.title?.toLowerCase() || 'items'} and press Enter to add them (optional but recommended)
              </p>
            </div>
            
            <div className="bg-card p-4 rounded-lg space-y-4">
              <Input
                type="text"
                placeholder={`Enter a specific ${subcategoryData?.title?.toLowerCase().slice(0, -1) || 'item'}...`}
                value={currentInput}
                onChange={(e) => {
                  console.log('Input changed:', e.target.value); // Debug log
                  setCurrentInput(e.target.value);
                }}
                onKeyDown={(e) => {
                  console.log('Key pressed:', e.key); // Debug log
                  handleInputKeyDown(e);
                }}
                spellCheck={true}
                className="w-full text-center text-lg font-medium placeholder:text-muted-foreground bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition-all"
                autoFocus
              />
              
              {/* Suggestions list from themes */}
              {subcategoryData?.themes && currentInput.trim().length > 0 && (
                <div className="rounded-md border border-border">
                  <ScrollArea className="max-h-64">
                    <div className="p-1">
                      {subcategoryData.themes
                        .filter(t => t.title.toLowerCase().includes(currentInput.toLowerCase()))
                        .slice(0, 12)
                        .map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              if (!specificItems.includes(t.title)) {
                                const newItems = [...specificItems, t.title];
                                setSpecificItems(newItems);
                                updateData({
                                  category: data.category,
                                  subcategory: data.subcategory,
                                  specificItems: newItems,
                                  specificItem: newItems.join(', ')
                                });
                                setCurrentInput('');
                              }
                            }}
                            className="w-full text-left px-3 py-2 rounded-md hover:bg-accent"
                          >
                            {t.title}
                          </button>
                        ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <div className="text-center">
                <Button
                  onClick={() => {
                    console.log('Skip button clicked'); // Debug log
                    setSpecificItems([]);
                    updateData({ 
                      category: data.category,
                      subcategory: data.subcategory,
                      specificItem: "any", 
                      specificItems: [] 
                    });
                  }}
                  variant="ghost"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Skip - Any {subcategoryData?.title?.toLowerCase().slice(0, -1) || 'item'} is fine
                </Button>
              </div>
            </div>
          </div>
        )}

      </>
    );
  }

  if (showingSubcategories && selectedCategoryData) {
    return (
      <div className="space-y-6">
        {/* Compact Selected Category */}
        <div className="rounded-xl border-2 border-cyan-400 bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-foreground">
              <span className="font-bold text-muted-foreground">Category</span> - <span className="font-normal">{selectedCategoryData.title}</span>
            </div>
            <button onClick={handleEditCategory} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">
              Edit
            </button>
          </div>
        </div>

        {/* Subcategory Search and List */}
        <div className="space-y-4">
          {/* Search Header */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
            <Input 
              type="text" 
              placeholder={selectedCategoryData.id === "miscellaneous" ? "Search miscellaneous topics" : "Search subcategories..."} 
              value={subcategorySearchQuery} 
              onChange={e => setSubcategorySearchQuery(e.target.value)} 
              spellCheck={true}
              className="pl-12 py-4 h-14 text-lg font-semibold text-cyan-600 placeholder:text-cyan-600 placeholder:font-semibold bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition-all" 
            />
          </div>

          {/* Individual Subcategory Items */}
          <div className="max-h-80 overflow-y-auto scrollbar-hide">
            <div className="space-y-3">
              {filteredSubcategories.map(subcategory => (
                <Card 
                  key={subcategory.id} 
                  className={cn(
                    "cursor-pointer p-3 transition-all duration-200 hover:bg-accent/50 hover:border-primary/50 border rounded-lg w-full",
                    {
                      "border-primary bg-accent shadow-sm": data.subcategory === subcategory.id,
                      "border-border hover:border-border": data.subcategory !== subcategory.id
                    }
                  )} 
                  onClick={() => handleSubcategorySelection(subcategory.id)}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-normal text-foreground text-sm">{subcategory.title}</h4>
                    <div className="text-muted-foreground text-sm">→</div>
                  </div>
                </Card>
              ))}
              {filteredSubcategories.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  No subcategories found
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-cyan-400" size={24} />
        <Input 
          type="text" 
          placeholder="Search categories and interests..." 
          value={searchQuery} 
          onChange={e => setSearchQuery(e.target.value)} 
          spellCheck={true}
          className="pl-14 pr-14 py-6 h-16 text-xl bg-background border-2 border-border rounded-xl focus:outline-none focus:ring-4 focus:ring-cyan-400/20 focus:border-cyan-400 transition-all placeholder:text-lg text-center" 
        />
      </div>

      {/* Search Results View */}
      {searchQuery.length > 0 ? (
        <div className="space-y-4">
          {searchResults.length > 0 ? (
            <>
              <h3 className="text-lg font-semibold text-foreground mb-4">
                {searchResults.some(r => r.matchType === 'theme') ? 'Search Results' : 'Specific Topics'}
              </h3>
              <div className="space-y-2">
                {searchResults.map((result, index) => (
                  <Card
                    key={`${result.categoryId}-${result.subcategoryId}-${result.themeId || 'sub'}-${index}`}
                    className="cursor-pointer p-4 transition-all duration-200 hover:bg-accent/50 hover:border-primary/50 border rounded-lg"
                    onClick={() => {
                      if (result.matchType === 'theme' && result.themeTitle) {
                        handleDirectThemeSelection(result.categoryId, result.subcategoryId, result.themeTitle);
                      } else {
                        handleDirectSubcategorySelection(result.categoryId, result.subcategoryId);
                      }
                    }}
                  >
                    {result.matchType === 'theme' && result.themeTitle ? (
                      // Theme result with breadcrumb
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="text-base font-semibold text-foreground">
                            {result.themeTitle}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>in {result.subcategoryTitle}</span>
                            <span>•</span>
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-white font-medium",
                              result.categoryColor
                            )}>
                              {result.categoryTitle}
                            </span>
                          </div>
                        </div>
                        <div className="text-muted-foreground text-sm">→</div>
                      </div>
                    ) : (
                      // Subcategory result (original format)
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium text-white",
                            result.categoryColor
                          )}>
                            {result.categoryTitle}
                          </span>
                          <span className="text-sm font-medium text-foreground">
                            {result.subcategoryTitle}
                          </span>
                        </div>
                        <div className="text-muted-foreground text-sm">→</div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <p>No results found for "{searchQuery}"</p>
              <p className="text-xs mt-2">Try a different search term or browse categories below</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Manual browse text */}
          <div className="text-center mb-8">
            <p className="text-muted-foreground text-sm">
              or search through the categories manually below
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {filteredGoals.map(goal => (
              <Card 
                key={goal.id} 
                className={cn(
                  "cursor-pointer overflow-hidden text-center transition-all duration-300 hover:scale-105", 
                  "border-2 bg-card hover:bg-accent hover:border-primary", 
                  {
                    "border-primary shadow-primary bg-accent": data.category === goal.id,
                    "border-border": data.category !== goal.id
                  }
                )} 
                onClick={() => handleCategorySelection(goal.id)}
              >
                {goal.image ? (
                  <>
                    <div className="w-full h-24 overflow-hidden">
                      <img src={goal.image} alt={goal.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-3 pt-2">
                      <h3 className="text-sm font-medium text-foreground">
                        {goal.title}
                      </h3>
                    </div>
                  </>
                ) : (
                  <div className="p-3">
                    <div className="mb-2 text-2xl">{goal.icon}</div>
                    <h3 className="text-sm font-medium text-foreground">
                      {goal.title}
                    </h3>
                  </div>
                )}
              </Card>
            ))}
          </div>
          
          {/* Customize Your Own Button */}
          <Button
            variant="outline"
            className="w-full h-[152px] text-lg font-medium border-2 hover:scale-105 transition-all duration-300"
            onClick={() => handleCategorySelection("custom")}
          >
            Customize Your Own
          </Button>
        </>
      )}
    </div>
  );
}