import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ArrowLeft, MoreVertical, Trash2, Edit } from "lucide-react";
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

  // Create flattened search results for direct subcategory selection
  const getSearchResults = () => {
    if (!searchQuery || searchQuery.length === 0) return [];
    
    const searchLower = searchQuery.toLowerCase();
    const results: Array<{
      categoryId: string;
      categoryTitle: string;
      subcategoryId: string;
      subcategoryTitle: string;
      categoryColor: string;
    }> = [];

    fitnessGoals.forEach(goal => {
      // Check subcategories for matches
      (goal.subcategories as SubcategoryItem[]).forEach((subcategory: SubcategoryItem) => {
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
            categoryColor: getCategoryColor(goal.title)
          });
        }
      });
    });

    // Sort results by relevance (exact matches first, then partial matches)
    return results.sort((a, b) => {
      const aExact = a.subcategoryTitle.toLowerCase() === searchLower;
      const bExact = b.subcategoryTitle.toLowerCase() === searchLower;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return a.subcategoryTitle.localeCompare(b.subcategoryTitle);
    });
  };

  // Get category color for badges
  const getCategoryColor = (categoryTitle: string) => {
    const colors = {
      'Celebrations': 'bg-pink-500',
      'Daily Life': 'bg-blue-500', 
      'Sports': 'bg-green-500',
      'Work & Career': 'bg-purple-500',
      'Entertainment': 'bg-orange-500',
      'Random & Fun': 'bg-yellow-500'
    };
    return colors[categoryTitle as keyof typeof colors] || 'bg-gray-500';
  };

  const searchResults = getSearchResults();

  // Handle direct subcategory selection from search results
  const handleDirectSubcategorySelection = (categoryId: string, subcategoryId: string) => {
    // Check if this is Pop Culture and requires specific item input
    if (categoryId === "pop-culture") {
      const subcategoriesRequiringSpecificItem = ["movies", "tv-shows", "celebrities", "music", "anime", "fictional-characters"];
      if (subcategoriesRequiringSpecificItem.includes(subcategoryId)) {
        // Set category and subcategory but don't proceed - wait for specific item input
        updateData({
          category: categoryId,
          subcategory: subcategoryId,
          specificItem: ""
        });
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
          specificItem: ""
        });
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
      specificItem: ""
    });
  };
  
  const handleEditSubcategory = () => {
    updateData({
      subcategory: "",
      specificItem: ""
    });
  };
  
  const handleBack = () => {
    setShowingSubcategories(false);
    setSelectedCategory(null);
    setSearchQuery("");
    setSubcategorySearchQuery("");
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

          {/* Selected Subcategory */}
          <div className="flex items-center justify-between p-4 border-t border-border">
            <div className="text-sm text-foreground">
              <span className="font-bold text-muted-foreground">Type</span> - <span className="font-normal">{subcategoryData?.title}</span>
            </div>
            <button onClick={handleEditSubcategory} className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors">
              Edit
            </button>
          </div>

          {/* Specific Item Display for Pop Culture */}
          {data.category === "pop-culture" && data.specificItem && (
            <div className="flex items-center justify-between p-4 border-t border-border">
              <div className="text-sm text-foreground">
                <span className="font-bold text-muted-foreground">Specific {subcategoryData?.title?.slice(0, -1) || 'Item'}</span> - <span className="font-normal">{data.specificItem}</span>
              </div>
              <button 
                onClick={() => updateData({ specificItem: "" })} 
                className="text-cyan-400 hover:text-cyan-500 text-sm font-medium transition-colors"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Specific Item Input for Pop Culture subcategories - when missing */}
        {data.category === "pop-culture" && data.subcategory && !data.specificItem && 
         ["movies", "tv-shows", "celebrities", "music", "anime", "fictional-characters"].includes(data.subcategory) && (
          <div className="mt-6 space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-medium text-foreground mb-2">
                Is there a certain "{subcategoryData?.title?.slice(0, -1) || 'item'}" you want?
              </h3>
              <p className="text-sm text-muted-foreground">
                Enter a specific {subcategoryData?.title?.toLowerCase().slice(0, -1) || 'item'} name (optional but recommended)
              </p>
            </div>
            
            <div className="bg-card p-4 rounded-lg">
              <Input
                type="text"
                placeholder={`Enter a specific ${subcategoryData?.title?.toLowerCase().slice(0, -1) || 'item'}...`}
                value={data.specificItem || ""}
                onChange={(e) => updateData({ specificItem: e.target.value })}
                spellCheck={true}
                className="w-full text-center text-lg font-medium placeholder:text-muted-foreground bg-background border border-border rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition-all"
              />
              <div className="mt-3 text-center">
                <Button
                  onClick={() => updateData({ specificItem: "any" })}
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
              placeholder="Search subcategories..." 
              value={subcategorySearchQuery} 
              onChange={e => setSubcategorySearchQuery(e.target.value)} 
              className="pl-12 py-4 h-14 text-lg font-semibold text-cyan-600 placeholder:text-cyan-600 placeholder:font-semibold bg-background border border-border rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition-all" 
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
          className="pl-14 py-6 h-16 text-xl bg-background border-2 border-border rounded-xl focus:outline-none focus:ring-4 focus:ring-cyan-400/20 focus:border-cyan-400 transition-all placeholder:text-lg text-center" 
        />
      </div>

      {/* Search Results View */}
      {searchQuery.length > 0 ? (
        <div className="space-y-4">
          {searchResults.length > 0 ? (
            <>
              <h3 className="text-lg font-semibold text-foreground mb-4">Specific Topics</h3>
              <div className="space-y-2">
                {searchResults.map((result, index) => (
                  <Card
                    key={`${result.categoryId}-${result.subcategoryId}-${index}`}
                    className="cursor-pointer p-4 transition-all duration-200 hover:bg-accent/50 hover:border-primary/50 border rounded-lg"
                    onClick={() => handleDirectSubcategorySelection(result.categoryId, result.subcategoryId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "px-2 py-1 rounded-md text-xs font-medium text-white",
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
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <p>No specific topics found for "{searchQuery}"</p>
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
        </>
      )}
    </div>
  );
}