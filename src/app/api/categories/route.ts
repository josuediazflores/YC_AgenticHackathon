import { NextRequest, NextResponse } from 'next/server';
import { categoryOperations } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const includeSpending = request.nextUrl.searchParams.get('includeSpending') === 'true';
    
    if (includeSpending) {
      const categories = categoryOperations.getWithSpending();
      return NextResponse.json(categories);
    }
    
    const categories = categoryOperations.getAll();
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, budget_limit } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    const result = categoryOperations.create(name, description, budget_limit);
    const newCategory = categoryOperations.getById(result.lastInsertRowid as number);

    return NextResponse.json(newCategory, { status: 201 });
  } catch (error: any) {
    console.error('Error creating category:', error);
    
    if (error.message?.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { error: 'Category with this name already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
}
