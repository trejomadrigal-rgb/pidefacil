'use client';

import { useMenuDesignerStore } from '@/store/menu-designer.store';
import { useMenus } from '@/hooks/use-menus';
import { useCategories } from '@/hooks/use-categories';
import { useProducts } from '@/hooks/use-products';
import { MenuForm } from './menu-form';
import { CategoryForm } from './category-form';
import { ProductForm } from './product-form';

export function DetailPanel() {
  const {
    selectedMenuId,
    selectedCategoryId,
    selectedProductId,
    selectProduct,
    selectCategory,
    clearSelection,
  } = useMenuDesignerStore();

  const { data: menus = [] } = useMenus();
  const { data: categories = [] } = useCategories(selectedMenuId ?? undefined);
  const { data: products = [] } = useProducts(selectedCategoryId ?? undefined);

  const selectedMenu = menus.find((m) => m.id === selectedMenuId);
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const handleAddProduct = () => {
    // Use 'new' sentinel to signal create mode
    selectProduct('new');
  };

  const handleEditProduct = (product: { id: string }) => {
    selectProduct(product.id);
  };

  const handleProductClose = () => {
    // Return to the category view by clearing product selection only
    const currentCategoryId = useMenuDesignerStore.getState().selectedCategoryId;
    if (currentCategoryId) {
      selectCategory(currentCategoryId);
    } else {
      clearSelection();
    }
  };

  // Determine what to show
  const isAddingProduct = selectedProductId === 'new';
  const isEditingProduct = !!selectedProductId && selectedProductId !== 'new' && !!selectedProduct;
  const showProduct = (isAddingProduct || isEditingProduct) && !!selectedCategory;
  const showCategory = !showProduct && !!selectedCategoryId && !!selectedCategory;
  const showMenu = !showProduct && !showCategory && !!selectedMenuId && !!selectedMenu;

  return (
    <div className="flex-1 bg-white overflow-hidden flex flex-col">
      {showProduct && selectedCategory ? (
        <ProductForm
          product={isEditingProduct ? selectedProduct : undefined}
          categoryId={selectedCategory.id}
          onClose={handleProductClose}
        />
      ) : showCategory && selectedCategory ? (
        <CategoryForm
          category={selectedCategory}
          onAddProduct={handleAddProduct}
          onEditProduct={handleEditProduct}
        />
      ) : showMenu && selectedMenu ? (
        <MenuForm menu={selectedMenu} />
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-center px-8">
          <div className="text-4xl mb-4">🍽️</div>
          <h3 className="font-jakarta font-bold text-brand-900 text-sm mb-1">
            Selecciona un menú
          </h3>
          <p className="text-xs text-gray-400">
            Elige un menú del panel izquierdo para empezar a editarlo.
          </p>
        </div>
      )}
    </div>
  );
}
